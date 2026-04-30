<?php

namespace Tests\Feature;

use App\Mail\MemberInvitationMail;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    use RefreshDatabase;

    private function issueTestMemberToken(string $memberId, ?string $plainTextToken = null): string
    {
        $plainTextToken ??= 'studos_test_'.Str::random(32);

        DB::table('member_auth_tokens')->insert([
            'id' => (string) Str::uuid(),
            'member_id' => $memberId,
            'token_hash' => hash('sha256', $plainTextToken),
            'name' => 'test',
            'last_used_at' => null,
            'expires_at' => now()->addDays(30)->format('Y-m-d H:i:s'),
            'revoked_at' => null,
            'created_at' => now()->format('Y-m-d H:i:s'),
        ]);

        return $plainTextToken;
    }

    private function createActiveDemoMember(string $id, string $displayName, string $email): void
    {
        $parts = explode(' ', $displayName, 2);

        DB::table('members')->insert([
            'id' => $id,
            'personal_code' => Str::upper(Str::slug($parts[0])).'-CHAT',
            'class_id' => 'demo-class',
            'school_id' => DB::table('classes')->where('id', 'demo-class')->value('school_id'),
            'display_name' => $displayName,
            'first_name' => $parts[0],
            'last_name' => $parts[1] ?? 'Test',
            'email' => $email,
            'role' => 'student',
            'status' => 'active',
            'joined_at' => now(),
        ]);
    }

    /**
     * A basic test example.
     */
    public function test_homepage_returns_public_landing_page(): void
    {
        $response = $this->get('/');

        $response
            ->assertStatus(200)
            ->assertSee('Studos')
            ->assertSee('Opret')
            ->assertSee('Login')
            ->assertSee('Google Play')
            ->assertSee('App Store')
            ->assertSee('mockup-index.png')
            ->assertSee('Kalender og events')
            ->assertSee('Mini games')
            ->assertSee('Klassewards')
            ->assertSee('Klassedyst')
            ->assertSee('assets/index-mockups/Kalender.png')
            ->assertSee('assets/index-mockups/Klassedyst.png');
    }

    public function test_old_index_html_redirects_to_app_url(): void
    {
        $response = $this->get('/index.html');

        $response->assertRedirect(config('app.url'));
    }

    public function test_roles_endpoint_returns_member_access_model(): void
    {
        $response = $this->getJson('/api/roles');

        $response
            ->assertStatus(200)
            ->assertJsonPath('roles.0.id', 'owner')
            ->assertJsonMissing(['id' => 'admin'])
            ->assertJsonPath('roles.2.permissions.0', 'view_class')
            ->assertJsonPath('statuses.1.id', 'active');
    }

    public function test_schools_endpoint_returns_dropdown_options(): void
    {
        $this->getJson('/api/schools')
            ->assertStatus(200)
            ->assertJsonPath('schools.0.name', 'Midtby Gymnasium');
    }

    public function test_public_class_id_lookup_returns_shareable_class_without_invite_code(): void
    {
        $this->getJson('/api/classes/id/MG-3B-26')
            ->assertStatus(200)
            ->assertJsonPath('class.classId', 'MG-3B-26')
            ->assertJsonPath('class.schoolName', 'Midtby Gymnasium')
            ->assertJsonPath('class.className', '3.B')
            ->assertJsonPath('class.activeMembers', 1)
            ->assertJsonMissingPath('class.inviteCode');
    }

    public function test_personal_code_lookup_returns_safe_member_preview(): void
    {
        $personalCode = DB::table('members')->where('id', 'demo-owner')->value('personal_code');

        $this->assertNotEmpty($personalCode);

        $this->getJson('/api/members/code/'.$personalCode)
            ->assertStatus(200)
            ->assertJsonPath('member.displayName', 'Chris')
            ->assertJsonPath('member.class.classId', 'MG-3B-26')
            ->assertJsonMissingPath('member.email')
            ->assertJsonMissingPath('member.phone')
            ->assertJsonMissingPath('member.birthday');
    }

    public function test_personal_codes_create_consent_based_connection_requests(): void
    {
        DB::table('classes')->insert([
            'id' => 'other-class',
            'public_id' => 'TG-3C-26',
            'school_name' => 'Test Gymnasium',
            'class_name' => '3.C',
            'graduation_year' => '2026',
            'graduation_date' => '2026-06-25',
            'owner_name' => 'Maja Social',
            'owner_email' => 'maja.social@example.test',
            'invite_code' => 'STU-OTHER26',
            'join_policy' => 'approval',
            'allow_member_posts' => true,
            'require_approval_for_photos' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('members')->insert([
            'id' => 'other-member',
            'personal_code' => 'MAJA-DISCO',
            'class_id' => 'other-class',
            'display_name' => 'Maja Social',
            'first_name' => 'Maja',
            'last_name' => 'Social',
            'email' => 'maja.social@example.test',
            'role' => 'student',
            'status' => 'active',
            'joined_at' => now(),
        ]);

        $ownerToken = $this->issueTestMemberToken('demo-owner');
        $otherToken = $this->issueTestMemberToken('other-member');

        $this->postJson('/api/connections/request', [
            'personalCode' => 'MAJA-DISCO',
        ])->assertStatus(401);

        $request = $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/connections/request', [
                'requesterMemberId' => 'other-member',
                'personalCode' => 'MAJA-DISCO',
            ]);

        $request
            ->assertStatus(201)
            ->assertJsonPath('connection.status', 'pending')
            ->assertJsonPath('connection.direction', 'outgoing')
            ->assertJsonPath('connection.otherMember.displayName', 'Maja Social')
            ->assertJsonPath('connection.otherMember.class.classId', 'TG-3C-26')
            ->assertJsonMissingPath('connection.otherMember.email');

        $connectionId = $request->json('connection.id');

        $this
            ->withHeader('Authorization', 'Bearer invalid-token')
            ->getJson('/api/members/other-member/connections')
            ->assertStatus(401);

        $this
            ->withHeader('Authorization', 'Bearer '.$otherToken)
            ->getJson('/api/members/other-member/connections')
            ->assertStatus(200)
            ->assertJsonPath('connections.0.direction', 'incoming')
            ->assertJsonPath('connections.0.status', 'pending');

        $this
            ->withHeader('Authorization', 'Bearer '.$otherToken)
            ->postJson('/api/connections/'.$connectionId.'/respond', [
                'memberId' => 'demo-owner',
                'status' => 'accepted',
            ])
            ->assertStatus(200)
            ->assertJsonPath('connection.status', 'accepted');

        $this->assertDatabaseHas('member_connections', [
            'id' => $connectionId,
            'requester_member_id' => 'demo-owner',
            'receiver_member_id' => 'other-member',
            'status' => 'accepted',
        ]);

        $ownCode = DB::table('members')->where('id', 'demo-owner')->value('personal_code');
        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/connections/request', [
                'personalCode' => $ownCode,
            ])->assertStatus(422);
    }

    public function test_students_can_create_calendar_events_and_update_rsvp(): void
    {
        Storage::fake('public');

        $this->createActiveDemoMember('calendar-maja', 'Maja Kalender', 'maja.calendar@example.test');
        $this->createActiveDemoMember('calendar-tobias', 'Tobias Kalender', 'tobias.calendar@example.test');
        $ownerToken = $this->issueTestMemberToken('demo-owner');
        $majaToken = $this->issueTestMemberToken('calendar-maja');
        $tobiasToken = $this->issueTestMemberToken('calendar-tobias');
        $coverImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8AARQAFAAH/AVqGqAAAAABJRU5ErkJggg==';

        $this->postJson('/api/events', [
            'title' => 'Studentergilde hos Chris',
            'eventDate' => '2026-05-24',
            'eventTime' => '19:00',
        ])->assertStatus(401);

        $createResponse = $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/events', [
                'title' => 'Studentergilde hos Chris',
                'eventDate' => '2026-05-24',
                'eventTime' => '19:00',
                'location' => 'Chris have',
                'description' => 'Tag noget godt med.',
                'coverImageData' => $coverImageData,
                'inviteScope' => 'custom',
                'invitedMemberIds' => ['calendar-maja'],
            ]);

        $createResponse
            ->assertStatus(201)
            ->assertJsonPath('class.events.0.title', 'Studentergilde hos Chris')
            ->assertJsonPath('class.events.0.startsAt', '2026-05-24T19:00:00.000Z')
            ->assertJsonPath('class.events.0.location', 'Chris have')
            ->assertJsonPath('class.events.0.creator.displayName', 'Chris')
            ->assertJsonPath('class.events.0.myRsvp', 'attending')
            ->assertJsonPath('class.events.0.inviteScope', 'custom')
            ->assertJsonPath('class.events.0.inviteCount', 2)
            ->assertJsonPath('class.events.0.pendingCount', 1)
            ->assertJsonPath('class.events.0.attendingCount', 1)
            ->assertJsonPath('class.events.0.notAttendingCount', 0);

        $eventId = $createResponse->json('class.events.0.id');
        $coverImageUrl = $createResponse->json('class.events.0.coverImageUrl');

        $this->assertStringContainsString('/uploads/event-covers/'.$eventId.'-', $coverImageUrl);
        $coverPath = Str::after(parse_url($coverImageUrl, PHP_URL_PATH), '/storage/');

        $this->assertDatabaseHas('events', [
            'id' => $eventId,
            'class_id' => 'demo-class',
            'created_by_member_id' => 'demo-owner',
            'cover_image_url' => $coverPath,
            'rsvp_count' => 1,
        ]);
        $this->assertDatabaseHas('event_rsvps', [
            'event_id' => $eventId,
            'member_id' => 'demo-owner',
            'status' => 'attending',
        ]);
        $this->assertDatabaseHas('event_invites', [
            'event_id' => $eventId,
            'member_id' => 'demo-owner',
            'invited_by_member_id' => 'demo-owner',
        ]);
        $this->assertDatabaseHas('event_invites', [
            'event_id' => $eventId,
            'member_id' => 'calendar-maja',
            'invited_by_member_id' => 'demo-owner',
        ]);
        $this->assertDatabaseMissing('event_invites', [
            'event_id' => $eventId,
            'member_id' => 'calendar-tobias',
        ]);

        Storage::disk('public')->assertExists($coverPath);
        Storage::disk('public')->delete($coverPath);

        $this
            ->withHeader('Authorization', 'Bearer '.$tobiasToken)
            ->postJson('/api/events/'.$eventId.'/rsvp', [
                'status' => 'attending',
            ])
            ->assertStatus(403);

        $this
            ->withHeader('Authorization', 'Bearer '.$majaToken)
            ->postJson('/api/events/'.$eventId.'/rsvp', [
                'status' => 'not_attending',
            ])
            ->assertStatus(200)
            ->assertJsonPath('class.events.0.myRsvp', 'not_attending')
            ->assertJsonPath('class.events.0.inviteCount', 2)
            ->assertJsonPath('class.events.0.pendingCount', 0)
            ->assertJsonPath('class.events.0.attendingCount', 1)
            ->assertJsonPath('class.events.0.notAttendingCount', 1);

        $this->assertDatabaseHas('event_rsvps', [
            'event_id' => $eventId,
            'member_id' => 'calendar-maja',
            'status' => 'not_attending',
        ]);

        $this
            ->withHeader('Authorization', 'Bearer '.$majaToken)
            ->postJson('/api/events/'.$eventId.'/update', [
                'title' => 'Majas snyde-redigering',
                'eventDate' => '2026-05-25',
                'eventTime' => '20:30',
            ])
            ->assertStatus(403);

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/events/'.$eventId.'/update', [
                'title' => 'Studentergilde hos Chris - opdateret',
                'eventDate' => '2026-05-25',
                'eventTime' => '20:30',
                'location' => 'Chris terrasse',
                'description' => 'Ny tid og ny gæsteliste.',
                'inviteScope' => 'custom',
                'invitedMemberIds' => ['calendar-tobias'],
            ])
            ->assertStatus(200)
            ->assertJsonPath('class.events.0.title', 'Studentergilde hos Chris - opdateret')
            ->assertJsonPath('class.events.0.startsAt', '2026-05-25T20:30:00.000Z')
            ->assertJsonPath('class.events.0.location', 'Chris terrasse')
            ->assertJsonPath('class.events.0.inviteScope', 'custom')
            ->assertJsonPath('class.events.0.inviteCount', 2)
            ->assertJsonPath('class.events.0.pendingCount', 1)
            ->assertJsonPath('class.events.0.attendingCount', 1)
            ->assertJsonPath('class.events.0.notAttendingCount', 0);

        $this->assertDatabaseHas('event_invites', [
            'event_id' => $eventId,
            'member_id' => 'calendar-tobias',
            'invited_by_member_id' => 'demo-owner',
        ]);
        $this->assertDatabaseMissing('event_invites', [
            'event_id' => $eventId,
            'member_id' => 'calendar-maja',
        ]);
        $this->assertDatabaseMissing('event_rsvps', [
            'event_id' => $eventId,
            'member_id' => 'calendar-maja',
        ]);
        $this->assertDatabaseHas('events', [
            'id' => $eventId,
            'cover_image_url' => $coverPath,
        ]);

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/events/'.$eventId.'/update', [
                'title' => 'Studentergilde hos Chris - opdateret',
                'eventDate' => '2026-05-25',
                'eventTime' => '20:30',
                'location' => 'Chris terrasse',
                'description' => 'Ny tid og ny gæsteliste.',
                'coverImageMode' => 'template',
                'coverImageTemplateId' => 'gold',
                'inviteScope' => 'custom',
                'invitedMemberIds' => ['calendar-tobias'],
            ])
            ->assertStatus(200)
            ->assertJsonPath('class.events.0.coverImageUrl', null)
            ->assertJsonPath('class.events.0.coverImageTemplateId', 'gold');

        $this->assertDatabaseHas('events', [
            'id' => $eventId,
            'cover_image_url' => 'template:gold',
        ]);

        $coverUpdateResponse = $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/events/'.$eventId.'/update', [
                'title' => 'Studentergilde hos Chris - opdateret',
                'eventDate' => '2026-05-25',
                'eventTime' => '20:30',
                'location' => 'Chris terrasse',
                'description' => 'Ny tid og ny gæsteliste.',
                'coverImageMode' => 'upload',
                'coverImageData' => $coverImageData,
                'inviteScope' => 'custom',
                'invitedMemberIds' => ['calendar-tobias'],
            ])
            ->assertStatus(200)
            ->assertJsonPath('class.events.0.coverImageTemplateId', null);

        $updatedCoverImageUrl = $coverUpdateResponse->json('class.events.0.coverImageUrl');

        $this->assertStringContainsString('/uploads/event-covers/'.$eventId.'-', $updatedCoverImageUrl);
        $updatedCoverPath = Str::after(parse_url($updatedCoverImageUrl, PHP_URL_PATH), '/storage/');
        $this->assertNotSame($coverPath, $updatedCoverPath);
        $this->assertDatabaseHas('events', [
            'id' => $eventId,
            'cover_image_url' => $updatedCoverPath,
        ]);
        Storage::disk('public')->assertExists($updatedCoverPath);

        $this
            ->withHeader('Authorization', 'Bearer '.$tobiasToken)
            ->postJson('/api/events/'.$eventId.'/rsvp', [
                'status' => 'attending',
            ])
            ->assertStatus(200)
            ->assertJsonPath('class.events.0.attendingCount', 2)
            ->assertJsonPath('class.events.0.pendingCount', 0);

        $this
            ->withHeader('Authorization', 'Bearer '.$tobiasToken)
            ->postJson('/api/events/'.$eventId.'/report', [
                'reason' => 'Begivenhed rapporteret',
                'details' => 'Coveret skal gennemgås.',
            ])
            ->assertStatus(200)
            ->assertJsonPath('ok', true);

        $this->assertDatabaseHas('member_reports', [
            'reporter_member_id' => 'calendar-tobias',
            'reported_member_id' => 'demo-owner',
            'target_type' => 'calendar_event',
            'target_id' => $eventId,
            'status' => 'pending',
        ]);

        $blockResponse = $this
            ->withHeader('Authorization', 'Bearer '.$tobiasToken)
            ->postJson('/api/members/demo-owner/block', [
                'reason' => 'Blokeret fra kalender',
            ])
            ->assertStatus(200)
            ->assertJsonPath('ok', true);

        $this->assertDatabaseHas('member_blocks', [
            'blocker_member_id' => 'calendar-tobias',
            'blocked_member_id' => 'demo-owner',
            'reason' => 'Blokeret fra kalender',
        ]);
        $this->assertFalse(
            collect($blockResponse->json('class.events'))->contains(fn (array $event): bool => $event['id'] === $eventId)
        );

        $this
            ->withHeader('Authorization', 'Bearer '.$tobiasToken)
            ->postJson('/api/events/'.$eventId.'/delete')
            ->assertStatus(403);

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/events/'.$eventId.'/delete')
            ->assertStatus(200);

        $this->assertDatabaseMissing('events', ['id' => $eventId]);
        $this->assertDatabaseMissing('event_invites', ['event_id' => $eventId]);
        $this->assertDatabaseMissing('event_rsvps', ['event_id' => $eventId]);
    }

    public function test_authenticated_member_can_register_android_push_token(): void
    {
        $ownerToken = $this->issueTestMemberToken('demo-owner');
        $expoPushToken = 'ExpoPushToken['.Str::random(32).']';

        $this
            ->postJson('/api/notifications/push-token', [
                'expoPushToken' => $expoPushToken,
                'platform' => 'android',
            ])->assertStatus(401);

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/notifications/push-token', [
                'expoPushToken' => $expoPushToken,
                'platform' => 'ios',
            ])->assertStatus(422);

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/notifications/push-token', [
                'expoPushToken' => $expoPushToken,
                'platform' => 'android',
                'deviceName' => 'Pixel Test',
                'projectId' => 'b4da2c62-b9cd-442c-b8da-facc8e6dc689',
                'appVariant' => 'development',
                'nativeApplicationVersion' => '0.0.1',
                'nativeBuildVersion' => '1',
            ])
            ->assertStatus(200)
            ->assertJsonPath('ok', true);

        $this->assertDatabaseHas('member_push_tokens', [
            'member_id' => 'demo-owner',
            'expo_push_token' => $expoPushToken,
            'platform' => 'android',
            'device_name' => 'Pixel Test',
            'disabled_at' => null,
        ]);

        Http::fake([
            'https://exp.host/--/api/v2/push/send' => Http::response([
                'data' => [
                    ['status' => 'ok'],
                ],
            ]),
        ]);

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/notifications/test', [
                'title' => 'Studos test',
                'body' => 'Android push test.',
            ])
            ->assertStatus(200)
            ->assertJsonPath('sent', 1)
            ->assertJsonPath('message', 'Testnotifikation sendt til Android.');

        Http::assertSent(fn ($request) => $request->url() === 'https://exp.host/--/api/v2/push/send'
            && $request[0]['to'] === $expoPushToken
            && $request[0]['channelId'] === 'studos-default');
    }

    public function test_direct_chat_uses_auth_member_as_sender_and_tracks_read_status(): void
    {
        $this->createActiveDemoMember('chat-maja', 'Maja Chat', 'maja.chat@example.test');
        $ownerToken = $this->issueTestMemberToken('demo-owner');
        $majaToken = $this->issueTestMemberToken('chat-maja');

        $this->postJson('/api/chat/conversations/direct', [
            'memberId' => 'chat-maja',
        ])->assertStatus(401);

        $conversationResponse = $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/chat/conversations/direct', [
                'memberId' => 'chat-maja',
            ]);

        $conversationResponse
            ->assertStatus(201)
            ->assertJsonPath('conversation.type', 'direct')
            ->assertJsonPath('conversation.title', 'Maja Chat')
            ->assertJsonPath('conversation.canHide', true)
            ->assertJsonPath('conversation.canDeleteForEveryone', false);

        $conversationId = $conversationResponse->json('conversation.id');
        $majaPushToken = 'ExpoPushToken['.Str::random(32).']';

        DB::table('member_push_tokens')->insert([
            'id' => (string) Str::uuid(),
            'member_id' => 'chat-maja',
            'expo_push_token' => $majaPushToken,
            'platform' => 'android',
            'device_name' => 'Pixel Chat',
            'project_id' => 'b4da2c62-b9cd-442c-b8da-facc8e6dc689',
            'app_variant' => 'development',
            'native_application_version' => '0.0.1',
            'native_build_version' => '1',
            'last_registered_at' => now(),
            'disabled_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        Http::fake([
            'https://exp.host/--/api/v2/push/send' => Http::response([
                'data' => [
                    ['status' => 'ok'],
                ],
            ]),
        ]);

        $messageResponse = $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/chat/conversations/'.$conversationId.'/messages', [
                'senderMemberId' => 'chat-maja',
                'body' => 'Hej Maja 👋',
            ]);

        $messageResponse
            ->assertStatus(201)
            ->assertJsonPath('message.sender.id', 'demo-owner')
            ->assertJsonPath('message.isMine', true)
            ->assertJsonPath('message.readByOther', false)
            ->assertJsonPath('message.body', 'Hej Maja 👋');

        Http::assertSent(fn ($request) => $request->url() === 'https://exp.host/--/api/v2/push/send'
            && $request[0]['to'] === $majaPushToken
            && $request[0]['channelId'] === 'studos-default'
            && $request[0]['title'] === 'Chris'
            && $request[0]['body'] === 'Hej Maja 👋'
            && ! array_key_exists('richContent', $request[0])
            && $request[0]['data']['type'] === 'chat_message'
            && $request[0]['data']['screen'] === 'chat'
            && $request[0]['data']['conversationId'] === $conversationId);

        $messageId = $messageResponse->json('message.id');

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/chat/messages/'.$messageId.'/report', [
                'reason' => 'Egen besked',
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Du kan ikke rapportere din egen besked.');

        $this
            ->withHeader('Authorization', 'Bearer '.$majaToken)
            ->postJson('/api/chat/messages/'.$messageId.'/report', [
                'reason' => 'Test beskedrapport',
                'details' => 'Rapporteret fra testen.',
            ])
            ->assertStatus(200)
            ->assertJsonPath('ok', true);

        $this->assertDatabaseHas('member_reports', [
            'reporter_member_id' => 'chat-maja',
            'reported_member_id' => 'demo-owner',
            'target_type' => 'chat_message',
            'target_id' => $messageId,
            'reason' => 'Test beskedrapport',
            'status' => 'pending',
        ]);

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->deleteJson('/api/chat/messages/'.$messageId)
            ->assertStatus(200)
            ->assertJsonPath('ok', true);

        $this->assertDatabaseHas('chat_messages', [
            'id' => $messageId,
            'deleted_by_member_id' => 'demo-owner',
        ]);

        $this
            ->withHeader('Authorization', 'Bearer '.$majaToken)
            ->postJson('/api/chat/conversations/'.$conversationId.'/read', [
                'messageId' => $messageId,
            ])
            ->assertStatus(200)
            ->assertJsonPath('conversation.unreadCount', 0);

        $messagesResponse = $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->getJson('/api/chat/conversations/'.$conversationId.'/messages')
            ->assertStatus(200)
            ->assertJsonPath('messages.0.isDeleted', true)
            ->assertJsonPath('messages.0.body', '')
            ->assertJsonPath('messages.0.readByOther', true)
            ->assertJsonPath('messages.0.sender.isOnline', true);

        $majaParticipant = collect($messagesResponse->json('conversation.participants'))
            ->firstWhere('memberId', 'chat-maja');

        $this->assertTrue($majaParticipant['member']['isOnline']);
        $this->assertNotEmpty($majaParticipant['member']['lastSeenAt']);

        $muteResponse = $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/chat/conversations/'.$conversationId.'/mute', [
                'muted' => true,
            ])
            ->assertStatus(200)
            ->assertJsonPath('ok', true);

        $this->assertNotEmpty($muteResponse->json('conversation.mutedUntil'));

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/chat/conversations/'.$conversationId.'/mute', [
                'muted' => false,
            ])
            ->assertStatus(200)
            ->assertJsonPath('conversation.mutedUntil', '');

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/chat/conversations/'.$conversationId.'/report', [
                'reason' => 'Test rapport',
                'details' => 'Rapporteret fra testen.',
            ])
            ->assertStatus(200)
            ->assertJsonPath('ok', true);

        $this->assertDatabaseHas('member_reports', [
            'reporter_member_id' => 'demo-owner',
            'reported_member_id' => 'chat-maja',
            'target_type' => 'chat_conversation',
            'target_id' => $conversationId,
            'reason' => 'Test rapport',
            'status' => 'pending',
        ]);

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/chat/conversations/'.$conversationId.'/block')
            ->assertStatus(200)
            ->assertJsonPath('ok', true);

        $this->assertDatabaseHas('member_blocks', [
            'blocker_member_id' => 'demo-owner',
            'blocked_member_id' => 'chat-maja',
            'reason' => 'Blokeret fra chat',
        ]);

        $this->assertNotNull(
            DB::table('chat_participants')
                ->where('conversation_id', $conversationId)
                ->where('member_id', 'demo-owner')
                ->value('hidden_at')
        );

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/chat/conversations/'.$conversationId.'/messages', [
                'body' => 'Kan du se den?',
            ])
            ->assertStatus(403);

        $this
            ->withHeader('Authorization', 'Bearer '.$majaToken)
            ->postJson('/api/chat/conversations/'.$conversationId.'/messages', [
                'body' => 'Nej',
            ])
            ->assertStatus(403);

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/chat/conversations/direct', [
                'memberId' => 'chat-maja',
            ])
            ->assertStatus(403);
    }

    public function test_chat_push_skips_muted_recipients(): void
    {
        $this->createActiveDemoMember('chat-maja', 'Maja Chat', 'maja.chat@example.test');
        $ownerToken = $this->issueTestMemberToken('demo-owner');

        $conversationId = $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/chat/conversations/direct', [
                'memberId' => 'chat-maja',
            ])
            ->assertStatus(201)
            ->json('conversation.id');

        DB::table('member_push_tokens')->insert([
            'id' => (string) Str::uuid(),
            'member_id' => 'chat-maja',
            'expo_push_token' => 'ExpoPushToken['.Str::random(32).']',
            'platform' => 'android',
            'device_name' => 'Pixel Muted',
            'project_id' => 'b4da2c62-b9cd-442c-b8da-facc8e6dc689',
            'app_variant' => 'development',
            'native_application_version' => '0.0.1',
            'native_build_version' => '1',
            'last_registered_at' => now(),
            'disabled_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('chat_participants')
            ->where('conversation_id', $conversationId)
            ->where('member_id', 'chat-maja')
            ->update([
                'muted_until' => now()->addHour()->format('Y-m-d H:i:s'),
                'updated_at' => now()->format('Y-m-d H:i:s'),
            ]);
        Http::fake([
            'https://exp.host/--/api/v2/push/send' => Http::response([
                'data' => [
                    ['status' => 'ok'],
                ],
            ]),
        ]);

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/chat/conversations/'.$conversationId.'/messages', [
                'body' => 'Muted ping',
            ])
            ->assertStatus(201);

        Http::assertSentCount(0);
    }

    public function test_authenticated_member_can_update_profile_photo(): void
    {
        Storage::fake('public');

        $ownerToken = $this->issueTestMemberToken('demo-owner');
        $photoData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8AARQAFAAH/AVqGqAAAAABJRU5ErkJggg==';

        $this
            ->postJson('/api/profile/photo', [
                'profilePhotoData' => $photoData,
            ])
            ->assertStatus(401);

        $response = $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/profile/photo', [
                'profilePhotoData' => $photoData,
            ]);

        $response
            ->assertStatus(200)
            ->assertJsonPath('session.member.id', 'demo-owner')
            ->assertJsonPath('class.classId', 'MG-3B-26');

        $photoUrl = $response->json('session.member.profilePhotoUrl');

        $this->assertStringContainsString('/uploads/profile-photos/demo-owner-', $photoUrl);
        $photoPath = Str::after(parse_url($photoUrl, PHP_URL_PATH), '/storage/');
        $this->assertDatabaseHas('members', [
            'id' => 'demo-owner',
            'profile_photo_url' => $photoPath,
        ]);

        Storage::disk('public')->assertExists($photoPath);
        Storage::disk('public')->delete($photoPath);
    }

    public function test_group_chat_owner_can_delete_and_members_can_leave(): void
    {
        $this->createActiveDemoMember('chat-maja', 'Maja Chat', 'maja.chat@example.test');
        $this->createActiveDemoMember('chat-tobias', 'Tobias Chat', 'tobias.chat@example.test');
        $ownerToken = $this->issueTestMemberToken('demo-owner');
        $majaToken = $this->issueTestMemberToken('chat-maja');

        $groupResponse = $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/chat/conversations/group', [
                'title' => 'Vogntur plan',
                'memberIds' => ['chat-maja', 'chat-tobias'],
            ]);

        $groupResponse
            ->assertStatus(201)
            ->assertJsonPath('conversation.type', 'group')
            ->assertJsonPath('conversation.title', 'Vogntur plan')
            ->assertJsonPath('conversation.ownerMemberId', 'demo-owner')
            ->assertJsonPath('conversation.canDeleteForEveryone', true)
            ->assertJsonPath('conversation.canLeave', false)
            ->assertJsonPath('conversation.canHide', false)
            ->assertJsonPath('conversation.participants.0.role', 'owner');

        $conversationId = $groupResponse->json('conversation.id');

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/chat/conversations/'.$conversationId.'/leave')
            ->assertStatus(422)
            ->assertJsonPath('message', 'Ejeren skal slette gruppen eller overdrage ejerskab foerst.');

        $this
            ->withHeader('Authorization', 'Bearer '.$majaToken)
            ->postJson('/api/chat/conversations/'.$conversationId.'/leave')
            ->assertStatus(200)
            ->assertJsonPath('ok', true);

        $this->assertDatabaseHas('chat_participants', [
            'conversation_id' => $conversationId,
            'member_id' => 'chat-maja',
            'status' => 'left',
        ]);

        $this
            ->withHeader('Authorization', 'Bearer '.$majaToken)
            ->deleteJson('/api/chat/conversations/'.$conversationId)
            ->assertStatus(403);

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->deleteJson('/api/chat/conversations/'.$conversationId)
            ->assertStatus(200)
            ->assertJsonPath('ok', true);

        $this->assertDatabaseHas('chat_conversations', [
            'id' => $conversationId,
            'status' => 'deleted',
            'deleted_by_member_id' => 'demo-owner',
        ]);
    }

    public function test_realtime_channel_auth_requires_active_chat_participant(): void
    {
        config([
            'broadcasting.connections.reverb.key' => 'test-key',
            'broadcasting.connections.reverb.secret' => 'test-secret',
        ]);

        $this->createActiveDemoMember('chat-maja', 'Maja Chat', 'maja.chat@example.test');
        $this->createActiveDemoMember('chat-tobias', 'Tobias Chat', 'tobias.chat@example.test');
        $ownerToken = $this->issueTestMemberToken('demo-owner');
        $tobiasToken = $this->issueTestMemberToken('chat-tobias');
        $socketId = '1234.5678';

        $this
            ->postJson('/api/chat/realtime/auth', [
                'socket_id' => $socketId,
                'channel_name' => 'private-chat.missing',
            ])
            ->assertStatus(401);

        $conversationId = $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/chat/conversations/direct', [
                'memberId' => 'chat-maja',
            ])
            ->assertStatus(201)
            ->json('conversation.id');

        $channelName = 'private-chat.'.$conversationId;
        $expectedSignature = hash_hmac('sha256', $socketId.':'.$channelName, 'test-secret');

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/chat/realtime/auth', [
                'socket_id' => $socketId,
                'channel_name' => $channelName,
            ])
            ->assertStatus(200)
            ->assertJsonPath('auth', 'test-key:'.$expectedSignature);

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/chat/realtime/auth', [
                'socket_id' => $socketId,
                'channel_name' => 'public-chat.'.$conversationId,
            ])
            ->assertStatus(403);

        $this
            ->withHeader('Authorization', 'Bearer '.$tobiasToken)
            ->postJson('/api/chat/realtime/auth', [
                'socket_id' => $socketId,
                'channel_name' => $channelName,
            ])
            ->assertStatus(404);
    }

    public function test_moderation_blocks_bad_words_and_reserved_names(): void
    {
        $schoolId = DB::table('classes')->where('id', 'demo-class')->value('school_id');

        $this
            ->postJson('/api/classes/join', [
                'inviteCode' => 'STU-DEMO26',
                'schoolId' => $schoolId,
                'firstName' => 'Admin',
                'lastName' => 'Test',
                'email' => 'moderation.join@example.test',
                'birthday' => '2007-05-14',
                'password' => 'hemmeligt123',
                'passwordConfirmation' => 'hemmeligt123',
                'termsAccepted' => true,
                'privacyAccepted' => true,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('firstName');

        $this->assertDatabaseHas('moderation_violations', [
            'source' => 'member_signup_name',
            'field' => 'firstName',
            'violation_type' => 'reserved_name',
            'matched_term' => 'admin',
            'action' => 'blocked',
        ]);

        $this->createActiveDemoMember('moderation-maja', 'Maja Moderation', 'maja.moderation@example.test');
        $this->createActiveDemoMember('moderation-tobias', 'Tobias Moderation', 'tobias.moderation@example.test');
        $ownerToken = $this->issueTestMemberToken('demo-owner');

        $conversationId = $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/chat/conversations/direct', [
                'memberId' => 'moderation-maja',
            ])
            ->assertStatus(201)
            ->json('conversation.id');

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/chat/conversations/'.$conversationId.'/messages', [
                'body' => 'fuck af',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('body');

        $this->assertDatabaseHas('moderation_violations', [
            'source' => 'chat_message',
            'field' => 'body',
            'member_id' => 'demo-owner',
            'class_id' => 'demo-class',
            'violation_type' => 'blocked_term',
            'matched_term' => 'fuck',
            'action' => 'blocked',
        ]);

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/chat/conversations/'.$conversationId.'/messages', [
                'body' => 'send nudes',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('body');

        $this->assertDatabaseHas('moderation_violations', [
            'source' => 'chat_message',
            'field' => 'body',
            'member_id' => 'demo-owner',
            'class_id' => 'demo-class',
            'violation_type' => 'blocked_term',
            'matched_term' => 'send nudes',
            'action' => 'blocked',
        ]);

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/chat/conversations/'.$conversationId.'/messages', [
                'body' => 'Til slut ses vi ved skolen',
            ])
            ->assertStatus(201)
            ->assertJsonPath('message.body', 'Til slut ses vi ved skolen');

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/chat/conversations/group', [
                'title' => 'f.u.c.k gruppen',
                'memberIds' => ['moderation-maja', 'moderation-tobias'],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('title');

        $this->assertDatabaseHas('moderation_violations', [
            'source' => 'chat_group_title',
            'field' => 'title',
            'member_id' => 'demo-owner',
            'class_id' => 'demo-class',
            'violation_type' => 'compact_blocked_term',
            'matched_term' => 'fuck',
            'action' => 'blocked',
        ]);

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/chat/conversations/group', [
                'title' => 'Klassens kaelling',
                'memberIds' => ['moderation-maja', 'moderation-tobias'],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('title');

        $this->assertDatabaseHas('moderation_violations', [
            'source' => 'chat_group_title',
            'field' => 'title',
            'member_id' => 'demo-owner',
            'class_id' => 'demo-class',
            'violation_type' => 'blocked_term',
            'matched_term' => 'kaelling',
            'action' => 'blocked',
        ]);

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/events', [
                'title' => 'fuckfest',
                'eventDate' => '2026-05-24',
                'eventTime' => '19:00',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('title');

        $this->assertDatabaseHas('moderation_violations', [
            'source' => 'event_create',
            'field' => 'title',
            'member_id' => 'demo-owner',
            'class_id' => 'demo-class',
            'violation_type' => 'compact_blocked_term',
            'matched_term' => 'fuck',
            'action' => 'blocked',
        ]);

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/events', [
                'title' => 'hot or not',
                'eventDate' => '2026-05-24',
                'eventTime' => '19:00',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('title');

        $this->assertDatabaseHas('moderation_violations', [
            'source' => 'event_create',
            'field' => 'title',
            'member_id' => 'demo-owner',
            'class_id' => 'demo-class',
            'violation_type' => 'blocked_term',
            'matched_term' => 'hot or not',
            'action' => 'blocked',
        ]);
    }

    public function test_app_can_resolve_invite_code_and_create_profile(): void
    {
        Storage::fake('public');

        $classResponse = $this->getJson('/api/classes/invite/STU-DEMO26');
        $classResponse
            ->assertStatus(200)
            ->assertJsonPath('class.id', 'demo-class')
            ->assertJsonPath('class.classId', 'MG-3B-26')
            ->assertJsonPath('class.schoolName', 'Midtby Gymnasium')
            ->assertJsonPath('class.className', '3.B')
            ->assertJsonStructure(['class' => ['schoolId'], 'schools' => [['id', 'name']]])
            ->assertJsonMissingPath('class.members.0.personalCode');

        $this->getJson('/api/classes/invite/STU-DEMO26?memberId=demo-owner')
            ->assertStatus(200)
            ->assertJsonMissingPath('class.members.0.personalCode');

        $ownerToken = $this->issueTestMemberToken('demo-owner');

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->getJson('/api/classes/invite/STU-DEMO26')
            ->assertStatus(200)
            ->assertJsonStructure(['class' => ['members' => [['personalCode']]]]);

        $schoolId = $classResponse->json('class.schoolId');
        $photoData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8AARQAFAAH/AVqGqAAAAABJRU5ErkJggg==';

        $response = $this->postJson('/api/classes/join', [
            'inviteCode' => 'STU-DEMO26',
            'schoolId' => $schoolId,
            'firstName' => 'Maja',
            'lastName' => 'Test',
            'email' => 'maja.app@example.test',
            'phone' => '+45 12 34 56 78',
            'birthday' => '2007-05-14',
            'profilePhotoData' => $photoData,
            'password' => 'hemmeligt123',
            'passwordConfirmation' => 'hemmeligt123',
            'termsAccepted' => true,
            'privacyAccepted' => true,
        ]);

        $response
            ->assertStatus(200)
            ->assertJsonPath('session.member.displayName', 'Maja Test')
            ->assertJsonPath('session.member.email', 'maja.app@example.test')
            ->assertJsonPath('session.member.phone', '+45 12 34 56 78')
            ->assertJsonPath('session.member.birthday', '2007-05-14')
            ->assertJsonPath('session.member.role', 'student')
            ->assertJsonPath('session.member.status', 'pending')
            ->assertJsonStructure(['session' => ['token', 'tokenType', 'expiresAt', 'member' => ['personalCode']]])
            ->assertJsonPath('class.id', 'demo-class')
            ->assertJsonPath('class.classId', 'MG-3B-26');

        $this->assertDatabaseHas('members', [
            'class_id' => 'demo-class',
            'school_id' => $schoolId,
            'first_name' => 'Maja',
            'last_name' => 'Test',
            'email' => 'maja.app@example.test',
            'role' => 'student',
            'status' => 'pending',
            'privacy_version' => '2026-04-26',
        ]);

        $photoUrl = $response->json('session.member.profilePhotoUrl');
        $this->assertStringContainsString('/uploads/profile-photos/', $photoUrl);
        Storage::disk('public')->assertExists(Str::after(parse_url($photoUrl, PHP_URL_PATH), '/storage/'));

        $passwordHash = DB::table('members')->where('email', 'maja.app@example.test')->value('password_hash');
        $this->assertNotSame('hemmeligt123', $passwordHash);
        $this->assertTrue(Hash::check('hemmeligt123', $passwordHash));
    }

    public function test_join_rejects_school_that_does_not_match_invite_class(): void
    {
        DB::table('schools')->insert([
            'id' => 'wrong-school',
            'name' => 'Forkert Gymnasium',
            'name_key' => 'forkert-gymnasium',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->postJson('/api/classes/join', [
            'inviteCode' => 'STU-DEMO26',
            'schoolId' => 'wrong-school',
            'firstName' => 'Maja',
            'lastName' => 'Forkert',
            'email' => 'maja.wrong@example.test',
            'birthday' => '2007-05-14',
            'password' => 'hemmeligt123',
            'passwordConfirmation' => 'hemmeligt123',
            'termsAccepted' => true,
            'privacyAccepted' => true,
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Du kan kun joine med den skole, klassen er oprettet paa.');
    }

    public function test_existing_member_can_login_with_email_and_password(): void
    {
        $loginResponse = $this->postJson('/api/session/login', [
            'inviteCode' => 'STU-DEMO26',
            'email' => 'chris@skole.dk',
            'password' => 'studos123',
        ]);

        $loginResponse
            ->assertStatus(200)
            ->assertJsonPath('session.member.id', 'demo-owner')
            ->assertJsonPath('session.member.email', 'chris@skole.dk')
            ->assertJsonStructure(['session' => ['token', 'tokenType', 'expiresAt', 'member' => ['personalCode']]])
            ->assertJsonPath('class.id', 'demo-class');

        $token = $loginResponse->json('session.token');
        $this->assertIsString($token);
        $this->assertStringStartsWith('studos_', $token);
        $this->assertDatabaseHas('member_auth_tokens', [
            'member_id' => 'demo-owner',
            'token_hash' => hash('sha256', $token),
        ]);

        $this
            ->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/session/me')
            ->assertStatus(200)
            ->assertJsonPath('session.member.id', 'demo-owner')
            ->assertJsonMissingPath('session.token')
            ->assertJsonPath('class.id', 'demo-class');

        $this
            ->withHeader('Authorization', 'Bearer invalid-token')
            ->getJson('/api/session/me')
            ->assertStatus(401);

        $this->postJson('/api/session/login', [
            'inviteCode' => 'STU-DEMO26',
            'email' => 'chris@skole.dk',
            'password' => 'forkertkode',
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Email eller adgangskode er forkert.');
    }

    public function test_existing_member_can_request_and_verify_login_code(): void
    {
        $codeResponse = $this->postJson('/api/session/request-code', [
            'inviteCode' => 'STU-DEMO26',
            'email' => 'chris@skole.dk',
        ]);

        $codeResponse
            ->assertStatus(200)
            ->assertJsonPath('ok', true)
            ->assertJsonPath('debugCode', '123456');

        $this->postJson('/api/session/verify-code', [
            'inviteCode' => 'STU-DEMO26',
            'email' => 'chris@skole.dk',
            'code' => '123456',
        ])
            ->assertStatus(200)
            ->assertJsonPath('session.member.id', 'demo-owner')
            ->assertJsonPath('session.member.email', 'chris@skole.dk')
            ->assertJsonStructure(['session' => ['token', 'tokenType', 'expiresAt']])
            ->assertJsonPath('class.id', 'demo-class');
    }

    public function test_admin_requires_login(): void
    {
        $this->get('/admin')->assertRedirect('/login');
        $this->get('/admin/classes/demo-class')->assertRedirect('/login');
    }

    public function test_login_page_uses_cms_marketing_layout(): void
    {
        $this->get('/login')
            ->assertStatus(200)
            ->assertSee('login-screen', false)
            ->assertSee('CMS til studentertiden')
            ->assertSee('Åbn Studos admin')
            ->assertDontSee('app-header', false);
    }

    public function test_demo_class_dashboard_returns_admin_modules_after_login(): void
    {
        $this->post('/login', [
            'email' => 'chris@skole.dk',
            'password' => 'studos123',
        ])->assertRedirect('/admin');

        $this->get('/admin')->assertRedirect('/admin/classes/demo-class');

        $response = $this->get('/admin/classes/demo-class');

        $response
            ->assertStatus(200)
            ->assertSee('Overblik')
            ->assertSee('Medlemmer')
            ->assertSee('CMS')
            ->assertSee('Begivenheder');
    }

    public function test_class_identity_fields_are_readonly_in_cms_settings(): void
    {
        $this->actingAs(User::where('email', 'chris@skole.dk')->firstOrFail());

        $response = $this->get('/admin/classes/demo-class');
        $html = $response->getContent();

        $response->assertStatus(200);
        $this->assertStringNotContainsString('name="schoolName"', $html);
        $this->assertStringNotContainsString('name="inviteCode"', $html);
        $this->assertStringNotContainsString('overview-identity-pills', $html);
        $this->assertStringContainsString('STU-DEMO26', $html);
        $this->assertStringContainsString('KlasseID', $html);

        $this->from('/admin/classes/demo-class')
            ->patch('/admin/classes/demo-class/settings', [
                'schoolName' => 'Manipuleret Gymnasium',
                'className' => '3.Z',
                'graduationYear' => '2027',
                'graduationDate' => '2027-06-25',
                'inviteCode' => 'HACK-CODE',
                'joinPolicy' => 'closed',
            ])
            ->assertRedirect('/admin/classes/demo-class');

        $this->assertDatabaseHas('classes', [
            'id' => 'demo-class',
            'school_name' => 'Midtby Gymnasium',
            'class_name' => '3.Z',
            'graduation_year' => '2027',
            'graduation_date' => '2027-06-25',
            'invite_code' => 'STU-DEMO26',
            'join_policy' => 'closed',
        ]);
    }

    public function test_cms_member_creation_defaults_to_pending_account_status_without_status_controls(): void
    {
        $this->actingAs(User::where('email', 'chris@skole.dk')->firstOrFail());

        $response = $this->get('/admin/classes/demo-class');

        $response
            ->assertStatus(200)
            ->assertSee('account-status', false)
            ->assertDontSee('status-toggle', false)
            ->assertDontSee('<select name="status"', false)
            ->assertDontSee('value="removed"', false);

        $html = $response->getContent();
        $this->assertStringContainsString('data-dialog-open="add-member-dialog"', $html);
        $this->assertStringContainsString('id="add-member-dialog"', $html);
        $this->assertStringContainsString('class="modal-form"', $html);
        $this->assertStringNotContainsString('add-member-form', $html);
        $this->assertStringNotContainsString('href="#add-member-form"', $html);
        $this->assertStringNotContainsString('id="add-member-form" class="inline-create"', $html);

        Mail::fake();

        $this->from('/admin/classes/demo-class')
            ->post('/admin/classes/demo-class/members', [
                'displayName' => 'Cms Uden Email',
                'role' => 'student',
            ])
            ->assertRedirect('/admin/classes/demo-class')
            ->assertSessionHasErrors('email');

        Mail::assertNothingSent();

        $this->from('/admin/classes/demo-class')
            ->post('/admin/classes/demo-class/members', [
                'displayName' => 'Cms Nybruger',
                'email' => 'cms.nybruger@example.test',
                'role' => 'student',
                'status' => 'removed',
            ])
            ->assertRedirect('/admin/classes/demo-class');

        $this->assertDatabaseHas('members', [
            'class_id' => 'demo-class',
            'display_name' => 'Cms Nybruger',
            'email' => 'cms.nybruger@example.test',
            'role' => 'student',
            'status' => 'pending',
        ]);

        $schoolClass = DB::table('classes')->where('id', 'demo-class')->first();

        Mail::assertSent(MemberInvitationMail::class, function (MemberInvitationMail $mail) use ($schoolClass): bool {
            return $mail->hasTo('cms.nybruger@example.test')
                && $mail->displayName === 'Cms Nybruger'
                && $mail->className === $schoolClass->class_name
                && $mail->schoolName === $schoolClass->school_name
                && $mail->inviteCode === $schoolClass->invite_code
                && str_contains($mail->inviteUrl, 'invite='.$schoolClass->invite_code);
        });

        $this->assertNull(DB::table('members')->where('email', 'cms.nybruger@example.test')->value('password_hash'));

        $schoolId = DB::table('classes')->where('id', 'demo-class')->value('school_id');

        $this->postJson('/api/classes/join', [
            'inviteCode' => 'STU-DEMO26',
            'schoolId' => $schoolId,
            'firstName' => 'Cms',
            'lastName' => 'Nybruger',
            'email' => 'cms.nybruger@example.test',
            'birthday' => '2007-05-14',
            'password' => 'hemmeligt123',
            'passwordConfirmation' => 'hemmeligt123',
            'termsAccepted' => true,
            'privacyAccepted' => true,
        ])
            ->assertStatus(200)
            ->assertJsonPath('session.member.status', 'active');

        $this->assertDatabaseHas('members', [
            'class_id' => 'demo-class',
            'display_name' => 'Cms Nybruger',
            'email' => 'cms.nybruger@example.test',
            'role' => 'student',
            'status' => 'active',
        ]);
        $this->assertNotEmpty(DB::table('members')->where('email', 'cms.nybruger@example.test')->value('password_hash'));
    }

    public function test_removed_members_are_archived_separately_in_cms(): void
    {
        $this->createActiveDemoMember('cms-removed-member', 'Slettet Cmsbruger', 'slettet.cms@example.test');
        $this->actingAs(User::where('email', 'chris@skole.dk')->firstOrFail());

        $this->from('/admin/classes/demo-class')
            ->delete('/admin/classes/demo-class/members/cms-removed-member')
            ->assertRedirect('/admin/classes/demo-class');

        $this->assertDatabaseHas('members', [
            'id' => 'cms-removed-member',
            'status' => 'removed',
        ]);

        $response = $this->get('/admin/classes/demo-class');
        $response
            ->assertStatus(200)
            ->assertSee('Se fjernede medlemmer (1)')
            ->assertSee('Fjernede medlemmer')
            ->assertSee('Slettet Cmsbruger')
            ->assertSee('Gendan');

        $this->assertFalse($response->viewData('members')->contains('id', 'cms-removed-member'));
        $this->assertTrue($response->viewData('removedMembers')->contains('id', 'cms-removed-member'));

        $this->from('/admin/classes/demo-class')
            ->patch('/admin/classes/demo-class/members/cms-removed-member', [
                'role' => 'student',
                'status' => 'active',
            ])->assertRedirect('/admin/classes/demo-class');

        $this->assertDatabaseHas('members', [
            'id' => 'cms-removed-member',
            'status' => 'active',
        ]);

        $response = $this->get('/admin/classes/demo-class');
        $this->assertTrue($response->viewData('members')->contains('id', 'cms-removed-member'));
        $this->assertFalse($response->viewData('removedMembers')->contains('id', 'cms-removed-member'));
    }

    public function test_owner_can_bulk_archive_selected_members_in_cms(): void
    {
        $this->createActiveDemoMember('cms-bulk-alma', 'Alma Bulk', 'alma.bulk@example.test');
        $this->createActiveDemoMember('cms-bulk-bertil', 'Bertil Bulk', 'bertil.bulk@example.test');
        $this->actingAs(User::where('email', 'chris@skole.dk')->firstOrFail());

        $this->from('/admin/classes/demo-class')
            ->delete('/admin/classes/demo-class/members', [
                'memberIds' => ['cms-bulk-alma', 'cms-bulk-bertil'],
            ])
            ->assertRedirect('/admin/classes/demo-class');

        $this->assertDatabaseHas('members', [
            'id' => 'cms-bulk-alma',
            'status' => 'removed',
        ]);
        $this->assertDatabaseHas('members', [
            'id' => 'cms-bulk-bertil',
            'status' => 'removed',
        ]);

        $response = $this->get('/admin/classes/demo-class');
        $this->assertFalse($response->viewData('members')->contains('id', 'cms-bulk-alma'));
        $this->assertFalse($response->viewData('members')->contains('id', 'cms-bulk-bertil'));
        $this->assertTrue($response->viewData('removedMembers')->contains('id', 'cms-bulk-alma'));
        $this->assertTrue($response->viewData('removedMembers')->contains('id', 'cms-bulk-bertil'));
        $response
            ->assertSee('Fjern valgte')
            ->assertDontSee('member-remove-form', false)
            ->assertDontSee('>Fjern</button>', false);

        $this->from('/admin/classes/demo-class')
            ->delete('/admin/classes/demo-class/members', [
                'memberIds' => ['demo-owner'],
            ])
            ->assertRedirect('/admin/classes/demo-class')
            ->assertSessionHasErrors('member');

        $this->assertDatabaseHas('members', [
            'id' => 'demo-owner',
            'status' => 'active',
        ]);
    }

    public function test_student_cannot_access_web_admin_dashboard(): void
    {
        $user = User::factory()->create([
            'name' => 'Student User',
            'email' => 'student-web@example.test',
        ]);
        $this->createActiveDemoMember('student-web', 'Student Web', 'student-web@example.test');

        $this->actingAs($user);

        $this->get('/admin')
            ->assertStatus(200)
            ->assertSee('Du er allerede medlem af 3.B')
            ->assertSee('Ingen admin-adgang');
        $this->get('/admin/classes/demo-class')->assertForbidden();

        $this->post('/admin/classes', [
            'schoolId' => DB::table('classes')->where('id', 'demo-class')->value('school_id'),
            'className' => '3.S',
            'graduationYear' => '2026',
            'graduationDate' => '2026-06-24',
            'joinPolicy' => 'approval',
        ])
            ->assertRedirect('/admin')
            ->assertSessionHasErrors('class');
    }

    public function test_moderator_can_manage_cms_but_not_member_access(): void
    {
        $user = User::factory()->create([
            'name' => 'Moderator User',
            'email' => 'moderator-web@example.test',
        ]);
        $this->createActiveDemoMember('moderator-web', 'Moderator Web', 'moderator-web@example.test');
        DB::table('members')->where('id', 'moderator-web')->update(['role' => 'moderator']);

        $this->actingAs($user);

        $this->get('/admin')->assertRedirect('/admin/classes/demo-class');
        $this->get('/admin/classes/demo-class')
            ->assertStatus(200)
            ->assertSee('CMS')
            ->assertSee('Begivenheder')
            ->assertSee('Klasseindstillinger og medlemmer kræver ejeradgang');

        $this->post('/admin/classes/demo-class/content', [
            'type' => 'info',
            'title' => 'Moderator info',
            'body' => 'Husk fælles besked.',
            'sortOrder' => 10,
        ])->assertRedirect('/admin/classes/demo-class');

        $this->assertDatabaseHas('class_content_blocks', [
            'class_id' => 'demo-class',
            'title' => 'Moderator info',
        ]);

        $this->patch('/admin/classes/demo-class/members/demo-owner', [
            'role' => 'moderator',
            'status' => 'active',
        ])->assertForbidden();
    }

    public function test_api_member_access_can_only_be_changed_by_owner(): void
    {
        $this->createActiveDemoMember('api-moderator', 'API Moderator', 'api-moderator@example.test');
        $this->createActiveDemoMember('api-student', 'Student API', 'api-student@example.test');
        DB::table('members')->where('id', 'api-moderator')->update(['role' => 'moderator']);

        $moderatorToken = $this->issueTestMemberToken('api-moderator');

        $this->postJson('/api/classes/demo-class/members/api-student/access', [
            'role' => 'moderator',
        ], [
            'Authorization' => 'Bearer '.$moderatorToken,
        ])->assertForbidden();

        $ownerToken = $this->issueTestMemberToken('demo-owner');

        $this->postJson('/api/classes/demo-class/members/api-student/access', [
            'role' => 'moderator',
        ], [
            'Authorization' => 'Bearer '.$ownerToken,
        ])
            ->assertStatus(200)
            ->assertJsonPath('member.role', 'moderator');
    }

    public function test_public_create_class_creates_user_and_owner(): void
    {
        DB::table('schools')->insert([
            'id' => 'test-school',
            'name' => 'Test Gymnasium',
            'name_key' => 'test-gymnasium',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->post('/opret-klasse', [
            'ownerName' => 'Maja Test',
            'ownerEmail' => 'maja@example.test',
            'password' => 'hemmeligt123',
            'password_confirmation' => 'hemmeligt123',
            'schoolId' => 'test-school',
            'className' => '3.C',
            'graduationYear' => '2026',
            'graduationDate' => '2026-06-25',
            'joinPolicy' => 'approval',
        ]);

        $response->assertRedirect();
        $this->assertAuthenticated();
        $this->assertStringContainsString('/admin/classes/', $response->headers->get('Location'));
        $this->assertDatabaseHas('users', ['email' => 'maja@example.test']);

        $schoolClass = DB::table('classes')->where('class_name', '3.C')->first();
        $this->assertNotNull($schoolClass);
        $this->assertSame('TG-3C-26', $schoolClass->public_id);

        $this->assertDatabaseHas('members', [
            'class_id' => $schoolClass->id,
            'school_id' => 'test-school',
            'email' => 'maja@example.test',
            'role' => 'owner',
            'status' => 'active',
        ]);
    }

    public function test_authenticated_user_with_class_cannot_create_another_class(): void
    {
        $this->actingAs(User::where('email', 'chris@skole.dk')->firstOrFail());
        $demoSchoolId = DB::table('schools')->where('name', 'Midtby Gymnasium')->value('id');

        $response = $this->post('/admin/classes', [
            'schoolId' => $demoSchoolId,
            'className' => '3.D',
            'graduationYear' => '2026',
            'graduationDate' => '2026-06-24',
            'joinPolicy' => 'approval',
        ]);

        $response
            ->assertRedirect('/admin/classes/demo-class')
            ->assertSessionHasErrors('class');

        $schoolClass = DB::table('classes')->where('class_name', '3.D')->first();
        $this->assertNull($schoolClass);
    }

    public function test_authenticated_user_without_class_can_create_one_from_admin(): void
    {
        $user = User::factory()->create([
            'name' => 'No Class',
            'email' => 'noclass@example.test',
        ]);
        DB::table('schools')->insert([
            'id' => 'admin-school',
            'name' => 'Admin Gymnasium',
            'name_key' => 'admin-gymnasium',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($user);

        $this->get('/admin')
            ->assertStatus(200)
            ->assertSee('Opret din klasse')
            ->assertSee('Vælg skole')
            ->assertSee('Ingen klasse endnu');

        $response = $this->post('/admin/classes', [
            'schoolId' => 'admin-school',
            'className' => '3.D',
            'graduationYear' => '2026',
            'graduationDate' => '2026-06-24',
            'joinPolicy' => 'approval',
        ]);

        $response->assertRedirect();
        $this->assertStringContainsString('/admin/classes/', $response->headers->get('Location'));

        $schoolClass = DB::table('classes')->where('class_name', '3.D')->first();
        $this->assertNotNull($schoolClass);
        $this->assertSame('AG-3D-26', $schoolClass->public_id);
        $this->assertDatabaseHas('members', [
            'class_id' => $schoolClass->id,
            'school_id' => 'admin-school',
            'email' => 'noclass@example.test',
            'role' => 'owner',
        ]);
    }
}
