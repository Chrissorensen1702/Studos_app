<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\PushNotifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
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
            ->assertSee('Studos er i testfase.')
            ->assertSee('Appen er kun tilgængelig pr. invitation')
            ->assertSee('download-knapperne vises kun som design-preview')
            ->assertSee('HELT GRATIS')
            ->assertSee('Se appen')
            ->assertSee('FAQ')
            ->assertDontSee('/opret-klasse')
            ->assertDontSee('CMS-login')
            ->assertSee('Google Play')
            ->assertSee('App Store')
            ->assertSee('landing-feature-preview-hero')
            ->assertSee('Forrige mockup')
            ->assertSee('Næste mockup')
            ->assertSee('Kalender og RSVP')
            ->assertSee('Arcade Hub')
            ->assertSee('Leaderboard')
            ->assertSee('Nødkontakter')
            ->assertSee('assets/index-mockups/Kalender.png')
            ->assertSee('assets/index-mockups/Klassedyst.png')
            ->assertDontSee('Klassewards')
            ->assertDontSee('assets/index-mockups/Klasseawards.png');
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
        $displayName = DB::table('members')->where('id', 'demo-owner')->value('display_name');

        $this->assertNotEmpty($personalCode);
        $this->assertNotEmpty($displayName);

        $this->getJson('/api/members/code/'.$personalCode)
            ->assertStatus(200)
            ->assertJsonPath('member.displayName', (string) $displayName)
            ->assertJsonPath('member.class.classId', 'MG-3B-26')
            ->assertJsonMissingPath('member.email')
            ->assertJsonMissingPath('member.phone')
            ->assertJsonMissingPath('member.birthday');
    }

    public function test_member_can_delete_own_account_and_related_data_is_anonymized(): void
    {
        $memberId = 'delete-self';
        $inviteTargetId = 'delete-event-target';
        $eventId = 'delete-event-1';
        $inviteId = 'delete-invite-1';
        $reportId = 'delete-report-1';
        $violationId = 'delete-violation-1';
        $strikeId = 'delete-strike-1';
        $pushTokenId = 'delete-push-token';

        $this->createActiveDemoMember($memberId, 'Delete Me', 'delete.me@example.test');
        $this->createActiveDemoMember($inviteTargetId, 'Invite Target', 'invite.target@example.test');

        DB::table('events')->insert([
            'id' => $eventId,
            'class_id' => 'demo-class',
            'title' => 'Sletningstjek',
            'event_date' => now()->toDateString(),
            'rsvp_count' => 0,
            'created_at' => now(),
            'updated_at' => now(),
            'created_by_member_id' => $memberId,
        ]);

        DB::table('event_invites')->insert([
            'id' => $inviteId,
            'event_id' => $eventId,
            'member_id' => $inviteTargetId,
            'invited_by_member_id' => $memberId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('member_reports')->insert([
            'id' => $reportId,
            'reporter_member_id' => $memberId,
            'reported_member_id' => $inviteTargetId,
            'target_type' => 'member',
            'target_id' => $inviteTargetId,
            'reason' => 'Test rapport',
            'status' => 'pending',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('moderation_violations')->insert([
            'id' => $violationId,
            'member_id' => $memberId,
            'class_id' => 'demo-class',
            'source' => 'account_deletion_test',
            'field' => 'email',
            'violation_type' => 'test',
            'input_hash' => Str::random(64),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('member_strikes')->insert([
            'id' => $strikeId,
            'member_id' => $memberId,
            'class_id' => 'demo-class',
            'issued_by_member_id' => $inviteTargetId,
            'report_id' => $reportId,
            'reason' => 'Test strike',
            'strike_number' => 1,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('member_push_tokens')->insert([
            'id' => $pushTokenId,
            'member_id' => $memberId,
            'expo_push_token' => 'ExponentPushToken[delete-test-token]',
            'platform' => 'ios',
            'project_id' => 'studos-test',
            'last_registered_at' => now(),
            'created_at' => now(),
        ]);

        $token = $this->issueTestMemberToken($memberId);

        $this
            ->withHeader('Authorization', 'Bearer '.$token)
            ->deleteJson('/api/members/me')
            ->assertStatus(200)
            ->assertJsonPath('ok', true)
            ->assertJsonPath('message', 'Kontoen er slettet permanent og personoplysninger er anonymiseret.');

        $deletedMember = DB::table('members')->where('id', $memberId)->first();

        $this->assertNotNull($deletedMember);
        $this->assertSame('removed', $deletedMember->status);
        $this->assertNotNull($deletedMember->deletion_requested_at);
        $this->assertNotNull($deletedMember->deleted_at);
        $this->assertStringStartsWith('Slettet bruger ', $deletedMember->display_name);
        $this->assertNull($deletedMember->first_name);
        $this->assertNull($deletedMember->last_name);
        $this->assertNull($deletedMember->email);
        $this->assertNull($deletedMember->phone);
        $this->assertNull($deletedMember->birthday);
        $this->assertNull($deletedMember->personal_code);
        $this->assertNull($deletedMember->profile_photo_url);
        $this->assertNull($deletedMember->password_hash);
        $this->assertNull($deletedMember->terms_accepted_at);
        $this->assertNull($deletedMember->privacy_accepted_at);
        $this->assertNull($deletedMember->privacy_version);

        $this->assertSame(0, DB::table('member_auth_tokens')->where('member_id', $memberId)->count());
        $this->assertSame(0, DB::table('member_push_tokens')->where('member_id', $memberId)->count());
        $this->assertNull(DB::table('events')->where('id', $eventId)->value('created_by_member_id'));
        $this->assertNull(DB::table('event_invites')->where('id', $inviteId)->value('invited_by_member_id'));
        $this->assertNull(DB::table('member_reports')->where('id', $reportId)->value('reporter_member_id'));
        $this->assertNull(DB::table('member_reports')->where('id', $reportId)->value('reported_member_id'));
        $this->assertNull(DB::table('moderation_violations')->where('id', $violationId)->value('member_id'));
        $this->assertNull(DB::table('member_strikes')->where('id', $strikeId)->value('member_id'));
    }

    public function test_class_battle_ranks_classes_by_caps_per_active_member(): void
    {
        DB::table('members')->where('id', 'demo-owner')->update(['caps_balance' => 1000]);

        DB::table('classes')->insert([
            [
                'id' => 'battle-big-class',
                'public_id' => 'BG-3A-26',
                'school_name' => 'Big Gymnasium',
                'class_name' => '3.A',
                'graduation_year' => '2026',
                'graduation_date' => '2026-06-25',
                'owner_name' => 'Big Owner',
                'owner_email' => 'big.owner@example.test',
                'invite_code' => 'STU-BIG26',
                'join_policy' => 'approval',
                'allow_member_posts' => true,
                'require_approval_for_photos' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 'battle-small-class',
                'public_id' => 'SM-2B-26',
                'school_name' => 'Small Gymnasium',
                'class_name' => '2.B',
                'graduation_year' => '2026',
                'graduation_date' => '2026-06-25',
                'owner_name' => 'Small Owner',
                'owner_email' => 'small.owner@example.test',
                'invite_code' => 'STU-SMALL26',
                'join_policy' => 'approval',
                'allow_member_posts' => true,
                'require_approval_for_photos' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        DB::table('members')->insert([
            [
                'id' => 'battle-big-one',
                'personal_code' => 'BIG-ONE',
                'class_id' => 'battle-big-class',
                'display_name' => 'Big One',
                'first_name' => 'Big',
                'last_name' => 'One',
                'email' => 'big.one@example.test',
                'caps_balance' => 2000,
                'role' => 'student',
                'status' => 'active',
                'joined_at' => now(),
            ],
            [
                'id' => 'battle-big-two',
                'personal_code' => 'BIG-TWO',
                'class_id' => 'battle-big-class',
                'display_name' => 'Big Two',
                'first_name' => 'Big',
                'last_name' => 'Two',
                'email' => 'big.two@example.test',
                'caps_balance' => 2000,
                'role' => 'student',
                'status' => 'active',
                'joined_at' => now(),
            ],
            [
                'id' => 'battle-small-one',
                'personal_code' => 'SMALL-ONE',
                'class_id' => 'battle-small-class',
                'display_name' => 'Small One',
                'first_name' => 'Small',
                'last_name' => 'One',
                'email' => 'small.one@example.test',
                'caps_balance' => 3000,
                'role' => 'student',
                'status' => 'active',
                'joined_at' => now(),
            ],
        ]);

        $token = $this->issueTestMemberToken('demo-owner');

        $this->getJson('/api/class-battle', [
            'Authorization' => 'Bearer '.$token,
        ])
            ->assertStatus(200)
            ->assertJsonPath('metric', 'caps_per_active_member')
            ->assertJsonPath('classes.0.id', 'battle-small-class')
            ->assertJsonPath('classes.0.score', 3000)
            ->assertJsonPath('classes.0.totalCaps', 3000)
            ->assertJsonPath('classes.0.activeMembers', 1)
            ->assertJsonPath('classes.1.id', 'battle-big-class')
            ->assertJsonPath('classes.1.score', 2000)
            ->assertJsonPath('classes.1.totalCaps', 4000)
            ->assertJsonPath('classes.1.activeMembers', 2)
            ->assertJsonPath('classes.2.id', 'demo-class')
            ->assertJsonPath('classes.2.current', true)
            ->assertJsonPath('currentMember.capsBalance', 1000);
    }

    public function test_weekly_good_deed_claim_awards_caps_once_without_buddy_or_photo(): void
    {
        DB::table('members')->where('id', 'demo-owner')->update(['caps_balance' => 1000]);
        $token = $this->issueTestMemberToken('demo-owner');

        $claimResponse = $this
            ->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/good-deeds/claims');

        $claimResponse
            ->assertStatus(201)
            ->assertJsonPath('goodDeed.myClaim.status', 'approved')
            ->assertJsonPath('goodDeed.myClaim.member.id', 'demo-owner')
            ->assertJsonPath('goodDeed.myClaim.verifier.id', 'demo-owner')
            ->assertJsonPath('goodDeed.myClaim.baseCaps', 25)
            ->assertJsonPath('goodDeed.myClaim.photoBonusCaps', 0)
            ->assertJsonPath('goodDeed.myClaim.totalCaps', 25)
            ->assertJsonPath('awardedCaps', 25)
            ->assertJsonPath('capsBalance', 1025)
            ->assertJsonCount(0, 'goodDeed.pendingVerifications')
            ->assertJsonCount(0, 'goodDeed.buddyOptions');

        $claimId = $claimResponse->json('goodDeed.myClaim.id');

        $this->assertDatabaseHas('members', [
            'id' => 'demo-owner',
            'caps_balance' => 1025,
        ]);
        $this->assertDatabaseHas('cap_transactions', [
            'member_id' => 'demo-owner',
            'amount' => 25,
            'type' => 'weekly_good_deed',
            'source_id' => $claimId,
        ]);
        $this->assertSame(1, DB::table('cap_transactions')->where('source_id', $claimId)->count());

        $this
            ->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/good-deeds/claims')
            ->assertStatus(422)
            ->assertJsonPath('message', 'Du har allerede claimet ugens gode gerning.');
    }

    public function test_weekly_check_in_awards_caps_after_seven_days(): void
    {
        DB::table('members')->where('id', 'demo-owner')->update(['caps_balance' => 1000]);
        $token = $this->issueTestMemberToken('demo-owner');
        $baseDay = \Illuminate\Support\Carbon::parse('2026-05-04 10:00:00');

        for ($day = 0; $day < 7; $day++) {
            $this->travelTo($baseDay->copy()->addDays($day));

            $expectedVisibleStreak = $day === 6 ? 1 : $day + 1;
            $response = $this
                ->withHeader('Authorization', 'Bearer '.$token)
                ->postJson('/api/check-ins/weekly')
                ->assertOk()
                ->assertJsonPath('weeklyCheckIn.checkedInToday', true)
                ->assertJsonPath('weeklyCheckIn.streak', $expectedVisibleStreak);

            $response->assertJsonPath('awardedCaps', $day === 6 ? 100 : 0);
        }

        $this->assertDatabaseHas('members', [
            'id' => 'demo-owner',
            'caps_balance' => 1100,
        ]);
        $this->assertDatabaseHas('cap_transactions', [
            'member_id' => 'demo-owner',
            'amount' => 100,
            'type' => 'weekly_check_in',
        ]);

        $this
            ->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/check-ins/weekly')
            ->assertOk()
            ->assertJsonPath('weeklyCheckIn.streak', 1)
            ->assertJsonPath('awardedCaps', 0);

        $this->assertSame(1, DB::table('cap_transactions')->where('type', 'weekly_check_in')->count());
        $this->assertSame(1100, (int) DB::table('members')->where('id', 'demo-owner')->value('caps_balance'));

        $this->travelTo($baseDay->copy()->addDays(7));

        $this
            ->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/check-ins/weekly')
            ->assertOk()
            ->assertJsonPath('weeklyCheckIn.checkedInToday', false)
            ->assertJsonPath('weeklyCheckIn.streak', 1);

        $this
            ->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/check-ins/weekly')
            ->assertOk()
            ->assertJsonPath('weeklyCheckIn.streak', 2);
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

        $directChat = $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/chat/conversations/direct', [
                'memberId' => 'other-member',
            ])
            ->assertStatus(201);
        $directConversationId = $directChat->json('conversation.id');

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/members/other-member/block', [
                'reason' => 'Blokeret fra Mit crew',
            ])
            ->assertStatus(200)
            ->assertJsonPath('ok', true);

        $this->assertDatabaseHas('member_blocks', [
            'blocker_member_id' => 'demo-owner',
            'blocked_member_id' => 'other-member',
            'reason' => 'Blokeret fra Mit crew',
        ]);

        $this->assertNotNull(
            DB::table('chat_participants')
                ->where('conversation_id', $directConversationId)
                ->where('member_id', 'demo-owner')
                ->value('hidden_at')
        );

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->getJson('/api/members/demo-owner/connections')
            ->assertStatus(200)
            ->assertJsonCount(0, 'connections');

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
        $ownerDisplayName = DB::table('members')->where('id', 'demo-owner')->value('display_name');

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
            ->assertJsonPath('class.events.0.creator.displayName', (string) $ownerDisplayName)
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

    public function test_class_admins_can_review_reports_and_issue_strikes(): void
    {
        $this->createActiveDemoMember('reporter-student', 'Reporter Student', 'reporter.student@example.test');
        $this->createActiveDemoMember('strike-target', 'Strike Target', 'strike.target@example.test');

        $ownerToken = $this->issueTestMemberToken('demo-owner');
        $studentToken = $this->issueTestMemberToken('reporter-student');
        $targetToken = $this->issueTestMemberToken('strike-target');
        $now = now()->format('Y-m-d H:i:s');

        DB::table('chat_conversations')->insert([
            'id' => 'admin-report-chat',
            'class_id' => 'demo-class',
            'type' => 'direct',
            'title' => null,
            'direct_pair_key' => 'reporter-student:strike-target',
            'owner_member_id' => null,
            'created_by_member_id' => 'reporter-student',
            'status' => 'active',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('chat_messages')->insert([
            'id' => 'reported-message-1',
            'conversation_id' => 'admin-report-chat',
            'sender_member_id' => 'strike-target',
            'type' => 'text',
            'body' => 'Det her er den anmeldte besked.',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('member_reports')->insert([
            'id' => 'admin-report-1',
            'reporter_member_id' => 'reporter-student',
            'reported_member_id' => 'strike-target',
            'target_type' => 'chat_message',
            'target_id' => 'reported-message-1',
            'reason' => 'Ubehagelig besked',
            'details' => 'Beskeden skal vurderes.',
            'status' => 'pending',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $this
            ->withHeader('Authorization', 'Bearer '.$studentToken)
            ->getJson('/api/admin/reports')
            ->assertStatus(403);

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->getJson('/api/admin/reports')
            ->assertStatus(200)
            ->assertJsonPath('reports.0.id', 'admin-report-1')
            ->assertJsonPath('reports.0.targetLabel', 'Chatbesked')
            ->assertJsonPath('reports.0.targetPreview.body', 'Det her er den anmeldte besked.')
            ->assertJsonPath('reports.0.targetPreview.sender.displayName', 'Strike Target')
            ->assertJsonPath('reports.0.status', 'pending')
            ->assertJsonPath('reports.0.reportedMember.displayName', 'Strike Target')
            ->assertJsonPath('reports.0.strikeCount', 0);

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/admin/reports/admin-report-1/strike', [
                'reason' => 'Første strike',
            ])
            ->assertStatus(200)
            ->assertJsonPath('report.status', 'struck')
            ->assertJsonPath('report.strikeCount', 1)
            ->assertJsonPath('report.isExcluded', false);

        $this->assertDatabaseHas('member_reports', [
            'id' => 'admin-report-1',
            'status' => 'struck',
            'resolution' => 'strike',
            'reviewed_by_member_id' => 'demo-owner',
        ]);
        $this->assertDatabaseHas('member_strikes', [
            'member_id' => 'strike-target',
            'issued_by_member_id' => 'demo-owner',
            'report_id' => 'admin-report-1',
            'strike_number' => 1,
            'status' => 'active',
        ]);

        $firstStrikeId = DB::table('member_strikes')
            ->where('member_id', 'strike-target')
            ->where('report_id', 'admin-report-1')
            ->value('id');

        $this
            ->withHeader('Authorization', 'Bearer '.$targetToken)
            ->getJson('/api/session/me')
            ->assertStatus(200)
            ->assertJsonPath('session.strikeWarnings.0.id', $firstStrikeId)
            ->assertJsonPath('session.strikeWarnings.0.strikeNumber', 1)
            ->assertJsonPath('session.strikeWarnings.0.strikeLimit', 3)
            ->assertJsonPath('session.strikeWarnings.0.reason', 'Første strike');

        $this
            ->withHeader('Authorization', 'Bearer '.$targetToken)
            ->postJson('/api/members/me/strikes/'.$firstStrikeId.'/acknowledge')
            ->assertStatus(200)
            ->assertJsonPath('ok', true)
            ->assertJsonCount(0, 'strikeWarnings');

        $this
            ->withHeader('Authorization', 'Bearer '.$targetToken)
            ->getJson('/api/session/me')
            ->assertStatus(200)
            ->assertJsonCount(0, 'session.strikeWarnings');

        foreach (['admin-report-2', 'admin-report-3'] as $index => $reportId) {
            DB::table('member_reports')->insert([
                'id' => $reportId,
                'reporter_member_id' => 'reporter-student',
                'reported_member_id' => 'strike-target',
                'target_type' => 'gallery_photo',
                'target_id' => 'reported-photo-'.$index,
                'reason' => 'Gentagen rapportering',
                'status' => 'pending',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $this
                ->withHeader('Authorization', 'Bearer '.$ownerToken)
                ->postJson('/api/admin/reports/'.$reportId.'/strike')
                ->assertStatus(200)
                ->assertJsonPath('report.status', 'struck');
        }

        $this->assertSame(3, DB::table('member_strikes')->where('member_id', 'strike-target')->count());
        $this->assertSame('removed', DB::table('members')->where('id', 'strike-target')->value('status'));
    }

    public function test_authenticated_member_can_register_push_tokens(): void
    {
        $ownerToken = $this->issueTestMemberToken('demo-owner');
        $expoPushToken = 'ExpoPushToken['.Str::random(32).']';
        $iosExpoPushToken = 'ExpoPushToken['.Str::random(32).']';

        $this
            ->postJson('/api/notifications/push-token', [
                'expoPushToken' => $expoPushToken,
                'platform' => 'android',
            ])->assertStatus(401);

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/notifications/push-token', [
                'expoPushToken' => $expoPushToken,
                'platform' => 'web',
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

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/notifications/push-token', [
                'expoPushToken' => $iosExpoPushToken,
                'platform' => 'ios',
                'deviceName' => 'Chris iPhone',
                'projectId' => 'b4da2c62-b9cd-442c-b8da-facc8e6dc689',
                'appVariant' => 'preview',
                'nativeApplicationVersion' => '0.0.1',
                'nativeBuildVersion' => '1',
            ])
            ->assertStatus(200)
            ->assertJsonPath('ok', true);

        $this->assertDatabaseHas('member_push_tokens', [
            'member_id' => 'demo-owner',
            'expo_push_token' => $iosExpoPushToken,
            'platform' => 'ios',
            'device_name' => 'Chris iPhone',
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
                'body' => 'Push test.',
            ])
            ->assertStatus(200)
            ->assertJsonPath('sent', 2)
            ->assertJsonPath('message', 'Testnotifikation sendt.');

        Http::assertSent(function ($request) use ($expoPushToken, $iosExpoPushToken): bool {
            $messages = collect($request->data());
            $androidMessage = $messages->firstWhere('to', $expoPushToken);
            $iosMessage = $messages->firstWhere('to', $iosExpoPushToken);

            return $request->url() === 'https://exp.host/--/api/v2/push/send'
                && ($androidMessage['channelId'] ?? null) === 'studos-default'
                && $iosMessage
                && ! array_key_exists('channelId', $iosMessage);
        });
    }

    public function test_activities_feed_respects_visibility_blocks_and_minimizes_payload(): void
    {
        $ownerToken = $this->issueTestMemberToken('demo-owner');
        $this->createActiveDemoMember('activity-visible-member', 'Visible Ven', 'visible-feed@example.test');
        $this->createActiveDemoMember('activity-blocked-member', 'Blokeret Person', 'blocked-feed@example.test');

        $now = now();
        $nowString = $now->format('Y-m-d H:i:s');
        $todayBirthday = $now->copy()->subYears(18)->format('Y-m-d');

        DB::table('members')
            ->whereIn('id', ['activity-visible-member', 'activity-blocked-member'])
            ->update(['birthday' => $todayBirthday]);

        DB::table('member_blocks')->insert([
            'id' => (string) Str::uuid(),
            'blocker_member_id' => 'demo-owner',
            'blocked_member_id' => 'activity-blocked-member',
            'created_at' => $nowString,
        ]);

        DB::table('events')->insert([
            [
                'id' => 'activity-visible-event',
                'class_id' => 'demo-class',
                'title' => 'Inviteret event',
                'event_date' => $now->toDateString(),
                'rsvp_count' => 0,
                'event_type' => 'studentergilde',
                'starts_at' => $nowString,
                'created_by_member_id' => 'activity-visible-member',
                'invite_scope' => 'custom',
                'created_at' => $nowString,
                'updated_at' => $nowString,
            ],
            [
                'id' => 'activity-hidden-custom-event',
                'class_id' => 'demo-class',
                'title' => 'Skjult custom event',
                'event_date' => $now->toDateString(),
                'rsvp_count' => 0,
                'event_type' => 'studentergilde',
                'starts_at' => $nowString,
                'created_by_member_id' => 'activity-visible-member',
                'invite_scope' => 'custom',
                'created_at' => $nowString,
                'updated_at' => $nowString,
            ],
            [
                'id' => 'activity-blocked-event',
                'class_id' => 'demo-class',
                'title' => 'Blokeret event',
                'event_date' => $now->toDateString(),
                'rsvp_count' => 0,
                'event_type' => 'studentergilde',
                'starts_at' => $nowString,
                'created_by_member_id' => 'activity-blocked-member',
                'invite_scope' => 'class',
                'created_at' => $nowString,
                'updated_at' => $nowString,
            ],
        ]);

        DB::table('event_invites')->insert([
            'id' => (string) Str::uuid(),
            'event_id' => 'activity-visible-event',
            'member_id' => 'demo-owner',
            'invited_by_member_id' => 'activity-visible-member',
            'created_at' => $nowString,
            'updated_at' => $nowString,
        ]);

        DB::table('galleries')->insert([
            [
                'id' => 'activity-visible-gallery',
                'class_id' => 'demo-class',
                'name' => 'Fælles album',
                'visibility' => 'public',
                'audience' => 'class',
                'permission' => 'view',
                'member_ids' => null,
                'photo_count' => 0,
                'cover_image_url' => null,
                'created_by_member_id' => 'activity-visible-member',
                'deleted_at' => null,
                'deleted_by_member_id' => null,
                'created_at' => $nowString,
                'updated_at' => $nowString,
            ],
            [
                'id' => 'activity-blocked-gallery',
                'class_id' => 'demo-class',
                'name' => 'Blokeret album',
                'visibility' => 'public',
                'audience' => 'class',
                'permission' => 'view',
                'member_ids' => null,
                'photo_count' => 0,
                'cover_image_url' => null,
                'created_by_member_id' => 'activity-blocked-member',
                'deleted_at' => null,
                'deleted_by_member_id' => null,
                'created_at' => $nowString,
                'updated_at' => $nowString,
            ],
        ]);

        DB::table('gallery_photos')->insert([
            [
                'id' => 'activity-visible-photo',
                'gallery_id' => 'activity-visible-gallery',
                'member_id' => 'activity-visible-member',
                'image_url' => 'uploads/gallery-photos/activity-visible-photo.jpg',
                'deleted_at' => null,
                'deleted_by_member_id' => null,
                'created_at' => $nowString,
            ],
            [
                'id' => 'activity-blocked-gallery-photo',
                'gallery_id' => 'activity-blocked-gallery',
                'member_id' => 'activity-visible-member',
                'image_url' => 'uploads/gallery-photos/activity-blocked-gallery-photo.jpg',
                'deleted_at' => null,
                'deleted_by_member_id' => null,
                'created_at' => $nowString,
            ],
        ]);

        $response = $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->getJson('/api/activities?limit=80')
            ->assertOk();

        $activities = collect($response->json('activities'));

        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $this->assertTrue($activities->contains(fn (array $activity): bool => ($activity['meta'] ?? null) === 'Inviteret event'));
        $this->assertTrue($activities->contains(fn (array $activity): bool => ($activity['meta'] ?? null) === 'Fælles album'));
        $this->assertTrue($activities->contains(fn (array $activity): bool =>
            ($activity['type'] ?? null) === 'birthday'
            && str_contains($activity['text'] ?? '', 'Visible Ven')
        ));
        $this->assertTrue($activities->contains(fn (array $activity): bool =>
            ($activity['type'] ?? null) === 'member_joined'
            && ($activity['actor']['displayName'] ?? null) === 'Visible Ven'
            && ($activity['preview']['kind'] ?? null) === 'member'
        ));
        $this->assertFalse($activities->contains(fn (array $activity): bool => ($activity['meta'] ?? null) === 'Skjult custom event'));
        $this->assertFalse($activities->contains(fn (array $activity): bool => ($activity['meta'] ?? null) === 'Blokeret album'));
        $this->assertFalse($activities->contains(fn (array $activity): bool => str_contains($activity['text'] ?? '', 'Blokeret')));
        $this->assertTrue($activities
            ->pluck('actor')
            ->filter()
            ->every(fn (array $actor): bool =>
                ! array_key_exists('firstName', $actor)
                && ! array_key_exists('lastName', $actor)
                && ! array_key_exists('birthday', $actor)
            ));
    }

    public function test_galleries_endpoint_paginates_filters_sorts_and_limits_preview_photos(): void
    {
        $this->createActiveDemoMember('gallery-other', 'Gry Galleri', 'gry.gallery@example.test');
        $ownerToken = $this->issueTestMemberToken('demo-owner');
        $now = now();
        $galleries = [];

        foreach (range(1, 30) as $index) {
            $isPublic = $index % 2 === 0;
            $galleries[] = [
                'id' => 'gallery-'.$index,
                'class_id' => 'demo-class',
                'name' => sprintf('Album %02d', $index),
                'visibility' => $isPublic ? 'public' : 'private',
                'audience' => $isPublic ? 'class' : null,
                'permission' => $isPublic ? 'add' : null,
                'member_ids' => null,
                'photo_count' => $index,
                'cover_image_url' => null,
                'created_by_member_id' => 'demo-owner',
                'deleted_at' => null,
                'deleted_by_member_id' => null,
                'created_at' => $now->copy()->subMinutes(90 - $index)->format('Y-m-d H:i:s'),
                'updated_at' => $now->copy()->subMinutes(60 - $index)->format('Y-m-d H:i:s'),
            ];
        }

        $galleries[] = [
            'id' => 'hidden-private-gallery',
            'class_id' => 'demo-class',
            'name' => 'Skjult privat album',
            'visibility' => 'private',
            'audience' => null,
            'permission' => null,
            'member_ids' => null,
            'photo_count' => 999,
            'cover_image_url' => null,
            'created_by_member_id' => 'gallery-other',
            'deleted_at' => null,
            'deleted_by_member_id' => null,
            'created_at' => $now->format('Y-m-d H:i:s'),
            'updated_at' => $now->format('Y-m-d H:i:s'),
        ];

        DB::table('galleries')->insert($galleries);

        foreach (range(1, 6) as $index) {
            DB::table('gallery_photos')->insert([
                'id' => 'gallery-30-photo-'.$index,
                'gallery_id' => 'gallery-30',
                'member_id' => 'demo-owner',
                'image_url' => 'gallery-photos/gallery-30-'.$index.'.jpg',
                'deleted_at' => null,
                'deleted_by_member_id' => null,
                'created_at' => $now->copy()->addMinutes($index)->format('Y-m-d H:i:s'),
            ]);
        }

        $response = $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->getJson('/api/galleries?perPage=5&page=1&sort=photos');

        $response
            ->assertStatus(200)
            ->assertJsonPath('pagination.page', 1)
            ->assertJsonPath('pagination.perPage', 5)
            ->assertJsonPath('pagination.total', 30)
            ->assertJsonPath('pagination.hasMore', true)
            ->assertJsonPath('galleries.0.id', 'gallery-30')
            ->assertJsonPath('galleries.0.photoCount', 30);

        $this->assertCount(5, $response->json('galleries'));
        $this->assertCount(4, $response->json('galleries.0.previewPhotos'));
        $this->assertSame('gallery-30-photo-6', $response->json('galleries.0.previewPhotos.0.id'));

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->getJson('/api/galleries?perPage=20&visibility=public&sort=az&q=Album')
            ->assertStatus(200)
            ->assertJsonCount(15, 'galleries')
            ->assertJsonPath('galleries.0.id', 'gallery-2')
            ->assertJsonPath('galleries.0.visibility', 'public');
    }

    public function test_gallery_photo_download_requires_visible_gallery_access(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('uploads/gallery-photos/download-photo.jpg', 'fake-image');

        $this->createActiveDemoMember('gallery-download-member', 'Dina Download', 'dina.download@example.test');
        $ownerToken = $this->issueTestMemberToken('demo-owner');
        $memberToken = $this->issueTestMemberToken('gallery-download-member');
        $now = now()->format('Y-m-d H:i:s');

        DB::table('galleries')->insert([
            [
                'id' => 'download-public-gallery',
                'class_id' => 'demo-class',
                'name' => 'Download album',
                'visibility' => 'public',
                'audience' => 'class',
                'permission' => 'view',
                'member_ids' => null,
                'photo_count' => 1,
                'cover_image_url' => null,
                'created_by_member_id' => 'demo-owner',
                'deleted_at' => null,
                'deleted_by_member_id' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'download-private-gallery',
                'class_id' => 'demo-class',
                'name' => 'Privat download album',
                'visibility' => 'private',
                'audience' => null,
                'permission' => null,
                'member_ids' => null,
                'photo_count' => 1,
                'cover_image_url' => null,
                'created_by_member_id' => 'demo-owner',
                'deleted_at' => null,
                'deleted_by_member_id' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);

        DB::table('gallery_photos')->insert([
            [
                'id' => 'download-public-photo',
                'gallery_id' => 'download-public-gallery',
                'member_id' => 'demo-owner',
                'image_url' => 'uploads/gallery-photos/download-photo.jpg',
                'deleted_at' => null,
                'deleted_by_member_id' => null,
                'created_at' => $now,
            ],
            [
                'id' => 'download-private-photo',
                'gallery_id' => 'download-private-gallery',
                'member_id' => 'demo-owner',
                'image_url' => 'uploads/gallery-photos/download-photo.jpg',
                'deleted_at' => null,
                'deleted_by_member_id' => null,
                'created_at' => $now,
            ],
        ]);

        $this
            ->withHeader('Authorization', 'Bearer '.$memberToken)
            ->get('/api/gallery-photos/download-public-photo/download')
            ->assertRedirect();

        $this
            ->withHeader('Authorization', 'Bearer '.$memberToken)
            ->getJson('/api/gallery-photos/download-private-photo/download')
            ->assertStatus(403);

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->get('/api/gallery-photos/download-private-photo/download')
            ->assertRedirect();
    }

    public function test_overview_stats_count_profile_activity_and_accessible_photos(): void
    {
        $this->createActiveDemoMember('stats-member', 'Signe Statistik', 'signe.statistik@example.test');
        $this->createActiveDemoMember('stats-other', 'Oskar Statistik', 'oskar.statistik@example.test');
        $this->createActiveDemoMember('stats-third', 'Tilde Statistik', 'tilde.statistik@example.test');
        $token = $this->issueTestMemberToken('stats-member');
        $now = now()->format('Y-m-d H:i:s');

        DB::table('point_duels')->insert([
            [
                'id' => 'stats-duel-win',
                'class_id' => 'demo-class',
                'creator_member_id' => 'stats-member',
                'opponent_member_id' => 'stats-other',
                'judge_member_id' => null,
                'challenge' => 'Vind testen',
                'mode' => 'versus',
                'stake_caps' => 10,
                'status' => 'completed',
                'winner_member_id' => 'stats-member',
                'completed_by_member_id' => null,
                'completed_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'stats-duel-loss',
                'class_id' => 'demo-class',
                'creator_member_id' => 'stats-other',
                'opponent_member_id' => 'stats-member',
                'judge_member_id' => null,
                'challenge' => 'Tab testen',
                'mode' => 'versus',
                'stake_caps' => 10,
                'status' => 'completed',
                'winner_member_id' => 'stats-other',
                'completed_by_member_id' => null,
                'completed_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'stats-duel-cancelled',
                'class_id' => 'demo-class',
                'creator_member_id' => 'stats-member',
                'opponent_member_id' => 'stats-other',
                'judge_member_id' => null,
                'challenge' => 'Annulleret test',
                'mode' => 'versus',
                'stake_caps' => 10,
                'status' => 'cancelled',
                'winner_member_id' => null,
                'completed_by_member_id' => null,
                'completed_at' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'stats-duel-awaiting-opponent',
                'class_id' => 'demo-class',
                'creator_member_id' => 'stats-member',
                'opponent_member_id' => 'stats-other',
                'judge_member_id' => null,
                'challenge' => 'Afventer modstander',
                'mode' => 'versus',
                'stake_caps' => 10,
                'status' => 'awaitingOpponent',
                'winner_member_id' => null,
                'completed_by_member_id' => null,
                'completed_at' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'stats-duel-awaiting-result',
                'class_id' => 'demo-class',
                'creator_member_id' => 'stats-other',
                'opponent_member_id' => 'stats-member',
                'judge_member_id' => null,
                'challenge' => 'Afventer resultat',
                'mode' => 'versus',
                'stake_caps' => 10,
                'status' => 'awaitingResultConfirm',
                'winner_member_id' => 'stats-member',
                'completed_by_member_id' => 'stats-other',
                'completed_at' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'stats-duel-active',
                'class_id' => 'demo-class',
                'creator_member_id' => 'stats-member',
                'opponent_member_id' => 'stats-other',
                'judge_member_id' => null,
                'challenge' => 'Aktiv test',
                'mode' => 'versus',
                'stake_caps' => 10,
                'status' => 'active',
                'winner_member_id' => null,
                'completed_by_member_id' => null,
                'completed_at' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'stats-duel-judge-only',
                'class_id' => 'demo-class',
                'creator_member_id' => 'stats-other',
                'opponent_member_id' => 'stats-third',
                'judge_member_id' => 'stats-member',
                'challenge' => 'Dommer tæller ikke',
                'mode' => 'versus',
                'stake_caps' => 10,
                'status' => 'completed',
                'winner_member_id' => 'stats-other',
                'completed_by_member_id' => null,
                'completed_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);

        DB::table('events')->insert([
            [
                'id' => 'stats-event-attending-1',
                'class_id' => 'demo-class',
                'title' => 'Deltaget event 1',
                'event_date' => '2026-05-01',
                'rsvp_count' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'stats-event-attending-2',
                'class_id' => 'demo-class',
                'title' => 'Deltaget event 2',
                'event_date' => '2026-05-02',
                'rsvp_count' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'stats-event-declined',
                'class_id' => 'demo-class',
                'title' => 'Ikke deltaget event',
                'event_date' => '2026-05-03',
                'rsvp_count' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);

        DB::table('event_rsvps')->insert([
            [
                'id' => 'stats-rsvp-attending-1',
                'event_id' => 'stats-event-attending-1',
                'member_id' => 'stats-member',
                'status' => 'attending',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'stats-rsvp-attending-2',
                'event_id' => 'stats-event-attending-2',
                'member_id' => 'stats-member',
                'status' => 'attending',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'stats-rsvp-declined',
                'event_id' => 'stats-event-declined',
                'member_id' => 'stats-member',
                'status' => 'not_attending',
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);

        DB::table('galleries')->insert([
            [
                'id' => 'stats-own-private-gallery',
                'class_id' => 'demo-class',
                'name' => 'Eget privat album',
                'visibility' => 'private',
                'audience' => null,
                'permission' => null,
                'member_ids' => null,
                'photo_count' => 2,
                'cover_image_url' => null,
                'created_by_member_id' => 'stats-member',
                'deleted_at' => null,
                'deleted_by_member_id' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'stats-public-gallery',
                'class_id' => 'demo-class',
                'name' => 'Fælles album',
                'visibility' => 'public',
                'audience' => 'class',
                'permission' => 'view',
                'member_ids' => null,
                'photo_count' => 3,
                'cover_image_url' => null,
                'created_by_member_id' => 'stats-other',
                'deleted_at' => null,
                'deleted_by_member_id' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'stats-specific-gallery',
                'class_id' => 'demo-class',
                'name' => 'Specifikt album',
                'visibility' => 'public',
                'audience' => 'specific',
                'permission' => 'view',
                'member_ids' => json_encode(['stats-member']),
                'photo_count' => 4,
                'cover_image_url' => null,
                'created_by_member_id' => 'stats-other',
                'deleted_at' => null,
                'deleted_by_member_id' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'stats-hidden-private-gallery',
                'class_id' => 'demo-class',
                'name' => 'Skjult privat album',
                'visibility' => 'private',
                'audience' => null,
                'permission' => null,
                'member_ids' => null,
                'photo_count' => 5,
                'cover_image_url' => null,
                'created_by_member_id' => 'stats-other',
                'deleted_at' => null,
                'deleted_by_member_id' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);

        foreach ([
            'stats-own-private-gallery' => 2,
            'stats-public-gallery' => 3,
            'stats-specific-gallery' => 4,
            'stats-hidden-private-gallery' => 5,
        ] as $galleryId => $count) {
            foreach (range(1, $count) as $index) {
                DB::table('gallery_photos')->insert([
                    'id' => $galleryId.'-photo-'.$index,
                    'gallery_id' => $galleryId,
                    'member_id' => 'stats-other',
                    'image_url' => 'gallery-photos/'.$galleryId.'-'.$index.'.jpg',
                    'deleted_at' => null,
                    'deleted_by_member_id' => null,
                    'created_at' => $now,
                ]);
            }
        }

        DB::table('gallery_photos')
            ->where('id', 'stats-public-gallery-photo-3')
            ->update(['deleted_at' => $now, 'deleted_by_member_id' => 'stats-other']);

        $this
            ->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/overview/stats')
            ->assertStatus(200)
            ->assertJsonPath('stats.completedDuels', 2)
            ->assertJsonPath('stats.pendingDuels', 2)
            ->assertJsonPath('stats.activeDuels', 1)
            ->assertJsonPath('stats.wonDuels', 1)
            ->assertJsonPath('stats.lostDuels', 1)
            ->assertJsonPath('stats.attendedEvents', 2)
            ->assertJsonPath('stats.accessiblePhotos', 8);
    }

    public function test_direct_chat_uses_auth_member_as_sender_and_tracks_read_status(): void
    {
        $this->createActiveDemoMember('chat-maja', 'Maja Chat', 'maja.chat@example.test');
        DB::table('members')->where('id', 'chat-maja')->update(['caps_balance' => 1234]);
        $duelNow = now()->format('Y-m-d H:i:s');
        DB::table('point_duels')->insert([
            [
                'id' => 'chat-maja-duel-win',
                'class_id' => 'demo-class',
                'creator_member_id' => 'chat-maja',
                'opponent_member_id' => 'demo-owner',
                'judge_member_id' => null,
                'challenge' => 'Chat vundet dyst',
                'mode' => 'versus',
                'stake_caps' => 10,
                'status' => 'completed',
                'winner_member_id' => 'chat-maja',
                'completed_by_member_id' => null,
                'completed_at' => $duelNow,
                'created_at' => $duelNow,
                'updated_at' => $duelNow,
            ],
            [
                'id' => 'chat-maja-duel-loss',
                'class_id' => 'demo-class',
                'creator_member_id' => 'demo-owner',
                'opponent_member_id' => 'chat-maja',
                'judge_member_id' => null,
                'challenge' => 'Chat tabt dyst',
                'mode' => 'versus',
                'stake_caps' => 10,
                'status' => 'completed',
                'winner_member_id' => 'demo-owner',
                'completed_by_member_id' => null,
                'completed_at' => $duelNow,
                'created_at' => $duelNow,
                'updated_at' => $duelNow,
            ],
            [
                'id' => 'chat-maja-duel-active',
                'class_id' => 'demo-class',
                'creator_member_id' => 'chat-maja',
                'opponent_member_id' => 'demo-owner',
                'judge_member_id' => null,
                'challenge' => 'Chat aktiv dyst',
                'mode' => 'versus',
                'stake_caps' => 10,
                'status' => 'active',
                'winner_member_id' => null,
                'completed_by_member_id' => null,
                'completed_at' => null,
                'created_at' => $duelNow,
                'updated_at' => $duelNow,
            ],
        ]);
        $ownerToken = $this->issueTestMemberToken('demo-owner');
        $majaToken = $this->issueTestMemberToken('chat-maja');
        $ownerDisplayName = DB::table('members')
            ->where('id', 'demo-owner')
            ->value('display_name');

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

        $majaConversationParticipant = collect($conversationResponse->json('conversation.participants'))
            ->firstWhere('memberId', 'chat-maja');
        $this->assertSame(1234, $majaConversationParticipant['member']['capsBalance']);
        $this->assertSame(['won' => 1, 'lost' => 1], $majaConversationParticipant['member']['duelStats']);

        $conversationId = $conversationResponse->json('conversation.id');
        $majaPushToken = 'ExpoPushToken['.Str::random(32).']';
        $ownerPushToken = 'ExpoPushToken['.Str::random(32).']';

        DB::table('member_push_tokens')->insert([
            [
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
            ],
            [
                'id' => (string) Str::uuid(),
                'member_id' => 'demo-owner',
                'expo_push_token' => $ownerPushToken,
                'platform' => 'android',
                'device_name' => 'Pixel Owner',
                'project_id' => 'b4da2c62-b9cd-442c-b8da-facc8e6dc689',
                'app_variant' => 'development',
                'native_application_version' => '0.0.1',
                'native_build_version' => '1',
                'last_registered_at' => now(),
                'disabled_at' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
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
            && $request[0]['title'] === (string) $ownerDisplayName.' 💬'
            && $request[0]['body'] === 'Hej Maja 👋'
            && ! array_key_exists('richContent', $request[0])
            && $request[0]['data']['type'] === 'chat_message'
            && $request[0]['data']['screen'] === 'chat'
            && $request[0]['data']['conversationId'] === $conversationId);

        $messageId = $messageResponse->json('message.id');

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/chat/messages/'.$messageId.'/reactions', [
                'emoji' => '😂',
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Du kan ikke reagere på din egen besked.');

        $this->assertDatabaseMissing('chat_message_reactions', [
            'message_id' => $messageId,
            'member_id' => 'demo-owner',
        ]);

        $this
            ->withHeader('Authorization', 'Bearer '.$majaToken)
            ->postJson('/api/chat/messages/'.$messageId.'/reactions', [
                'emoji' => '😂',
            ])
            ->assertStatus(200)
            ->assertJsonPath('ok', true)
            ->assertJsonPath('message.reactions.0.emoji', '😂')
            ->assertJsonPath('message.reactions.0.count', 1)
            ->assertJsonPath('message.reactions.0.reactedByMe', true);

        Http::assertSent(fn ($request) => $request->url() === 'https://exp.host/--/api/v2/push/send'
            && $request[0]['to'] === $ownerPushToken
            && $request[0]['channelId'] === 'studos-default'
            && $request[0]['title'] === 'Ny reaktion'
            && $request[0]['body'] === 'Maja Chat reagerede på din besked 😂'
            && $request[0]['data']['type'] === 'chat_reaction'
            && $request[0]['data']['screen'] === 'chat'
            && $request[0]['data']['conversationId'] === $conversationId
            && $request[0]['data']['messageId'] === $messageId
            && $request[0]['data']['reactorMemberId'] === 'chat-maja'
            && $request[0]['data']['emoji'] === '😂');

        $this->assertDatabaseHas('chat_message_reactions', [
            'message_id' => $messageId,
            'member_id' => 'chat-maja',
            'emoji' => '😂',
        ]);

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->getJson('/api/chat/conversations/'.$conversationId.'/messages')
            ->assertStatus(200)
            ->assertJsonPath('messages.0.reactions.0.emoji', '😂')
            ->assertJsonPath('messages.0.reactions.0.count', 1)
            ->assertJsonPath('messages.0.reactions.0.reactedByMe', false);

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
        $this->assertSame(1234, $majaParticipant['member']['capsBalance']);
        $this->assertSame(['won' => 1, 'lost' => 1], $majaParticipant['member']['duelStats']);

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
        $this->createActiveDemoMember('chat-sofie', 'Sofie Chat', 'sofie.chat@example.test');
        $ownerToken = $this->issueTestMemberToken('demo-owner');
        $majaToken = $this->issueTestMemberToken('chat-maja');
        $tobiasToken = $this->issueTestMemberToken('chat-tobias');

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
            ->withHeader('Authorization', 'Bearer '.$tobiasToken)
            ->postJson('/api/chat/conversations/'.$conversationId.'/participants', [
                'memberIds' => ['chat-sofie'],
            ])
            ->assertStatus(403);

        $addResponse = $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/chat/conversations/'.$conversationId.'/participants', [
                'memberIds' => ['chat-sofie', 'chat-maja'],
            ]);

        $addResponse
            ->assertStatus(200)
            ->assertJsonPath('ok', true);

        $this->assertTrue(
            collect($addResponse->json('conversation.participants'))
                ->contains(fn (array $participant): bool => $participant['memberId'] === 'chat-sofie' && $participant['role'] === 'member')
        );
        $this->assertDatabaseHas('chat_participants', [
            'conversation_id' => $conversationId,
            'member_id' => 'chat-sofie',
            'status' => 'active',
        ]);

        $this
            ->withHeader('Authorization', 'Bearer '.$tobiasToken)
            ->patchJson('/api/chat/conversations/'.$conversationId, [
                'title' => 'Ny vognturstitel',
            ])
            ->assertStatus(403);

        $renameResponse = $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->patchJson('/api/chat/conversations/'.$conversationId, [
                'title' => 'Ny vognturstitel',
            ]);

        $renameResponse
            ->assertStatus(200)
            ->assertJsonPath('ok', true)
            ->assertJsonPath('conversation.title', 'Ny vognturstitel');

        $this->assertDatabaseHas('chat_conversations', [
            'id' => $conversationId,
            'title' => 'Ny vognturstitel',
        ]);

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

        $inboxChannelName = 'private-chat.member.demo-owner';
        $expectedInboxSignature = hash_hmac('sha256', $socketId.':'.$inboxChannelName, 'test-secret');

        $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/chat/realtime/auth', [
                'socket_id' => $socketId,
                'channel_name' => $inboxChannelName,
            ])
            ->assertStatus(200)
            ->assertJsonPath('auth', 'test-key:'.$expectedInboxSignature);

        $this
            ->withHeader('Authorization', 'Bearer '.$tobiasToken)
            ->postJson('/api/chat/realtime/auth', [
                'socket_id' => $socketId,
                'channel_name' => $inboxChannelName,
            ])
            ->assertStatus(403);

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
            'privacy_version' => '2026-05-11',
        ]);

        $photoUrl = $response->json('session.member.profilePhotoUrl');
        $this->assertStringContainsString('/uploads/profile-photos/', $photoUrl);
        Storage::disk('public')->assertExists(Str::after(parse_url($photoUrl, PHP_URL_PATH), '/storage/'));

        $passwordHash = DB::table('members')->where('email', 'maja.app@example.test')->value('password_hash');
        $this->assertNotSame('hemmeligt123', $passwordHash);
        $this->assertTrue(Hash::check('hemmeligt123', $passwordHash));
    }

    public function test_closed_class_code_lookup_returns_closed_access_message(): void
    {
        DB::table('classes')->where('id', 'demo-class')->update([
            'join_policy' => 'closed',
        ]);

        $this->getJson('/api/classes/invite/STU-DEMO26')
            ->assertStatus(403)
            ->assertJsonPath('message', 'Klassens adgang er lukket');
    }

    public function test_pending_invited_member_stays_pending_after_profile_completion(): void
    {
        $schoolId = DB::table('classes')->where('id', 'demo-class')->value('school_id');

        DB::table('members')->insert([
            'id' => 'pending-placeholder-member',
            'personal_code' => 'MARIA-PENDING',
            'class_id' => 'demo-class',
            'school_id' => $schoolId,
            'display_name' => 'Maria Pending',
            'first_name' => 'Maria',
            'last_name' => 'Pending',
            'email' => 'maria.pending@example.test',
            'role' => 'student',
            'status' => 'pending',
            'joined_at' => now(),
        ]);

        $this->postJson('/api/classes/join', [
            'inviteCode' => 'STU-DEMO26',
            'schoolId' => $schoolId,
            'firstName' => 'Maria',
            'lastName' => 'Pending',
            'email' => 'maria.pending@example.test',
            'birthday' => '2007-05-14',
            'password' => 'hemmeligt123',
            'passwordConfirmation' => 'hemmeligt123',
            'termsAccepted' => true,
            'privacyAccepted' => true,
        ])
            ->assertStatus(200)
            ->assertJsonPath('session.member.status', 'pending');

        $this->assertDatabaseHas('members', [
            'id' => 'pending-placeholder-member',
            'email' => 'maria.pending@example.test',
            'status' => 'pending',
        ]);

        $passwordHash = DB::table('members')->where('id', 'pending-placeholder-member')->value('password_hash');
        $this->assertTrue(Hash::check('hemmeligt123', $passwordHash));
    }

    public function test_join_rejects_email_already_used_in_another_class(): void
    {
        $schoolId = DB::table('classes')->where('id', 'demo-class')->value('school_id');

        DB::table('classes')->insert([
            'id' => 'other-class-for-join',
            'public_id' => 'MG-3D-26',
            'school_id' => $schoolId,
            'school_name' => 'Midtby Gymnasium',
            'class_name' => '3.D',
            'graduation_year' => '2026',
            'graduation_date' => '2026-06-28',
            'owner_name' => 'Anden Eier',
            'owner_email' => 'anden@example.test',
            'invite_code' => 'STU-3D26',
            'join_policy' => 'approval',
            'allow_member_posts' => true,
            'require_approval_for_photos' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->postJson('/api/classes/join', [
            'inviteCode' => 'STU-3D26',
            'schoolId' => $schoolId,
            'firstName' => 'Maja',
            'lastName' => 'Anden',
            'email' => 'chris@skole.dk',
            'birthday' => '2007-05-14',
            'password' => 'hemmeligt123',
            'passwordConfirmation' => 'hemmeligt123',
            'termsAccepted' => true,
            'privacyAccepted' => true,
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Denne email er allerede knyttet til en anden klasse.');

        $this->assertDatabaseMissing('members', [
            'class_id' => 'other-class-for-join',
            'email' => 'chris@skole.dk',
        ]);
    }

    public function test_api_class_creation_rejects_owner_email_that_is_used_in_another_class(): void
    {
        $schoolId = DB::table('classes')->where('id', 'demo-class')->value('school_id');

        $this->postJson('/api/classes', [
            'schoolId' => $schoolId,
            'className' => '3.D',
            'graduationYear' => '2026',
            'graduationDate' => '2026-06-28',
            'ownerName' => 'Maja Test',
            'ownerEmail' => 'chris@skole.dk',
            'joinPolicy' => 'approval',
        ])->assertStatus(422)
            ->assertJsonPath('message', 'Denne email er allerede knyttet til en anden klasse.');
    }

    public function test_app_can_create_class_and_owner_session(): void
    {
        $schoolId = DB::table('classes')->where('id', 'demo-class')->value('school_id');

        $response = $this->postJson('/api/classes', [
            'schoolId' => $schoolId,
            'className' => '3.E',
            'graduationYear' => '2026',
            'graduationDate' => '2026-06-29',
            'ownerName' => 'Maja Eier',
            'ownerEmail' => 'maja.owner@example.test',
            'ownerBirthday' => '2007-05-14',
            'password' => 'hemmeligt123',
            'passwordConfirmation' => 'hemmeligt123',
            'termsAccepted' => true,
            'privacyAccepted' => true,
            'joinPolicy' => 'approval',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('session.member.displayName', 'Maja Eier')
            ->assertJsonPath('session.member.email', 'maja.owner@example.test')
            ->assertJsonPath('session.member.role', 'owner')
            ->assertJsonPath('session.member.status', 'active')
            ->assertJsonStructure(['session' => ['token', 'tokenType', 'expiresAt', 'member' => ['personalCode']]])
            ->assertJsonPath('class.className', '3.E')
            ->assertJsonPath('class.settings.joinPolicy', 'approval');

        $token = $response->json('session.token');
        $classId = $response->json('class.id');

        $this->assertDatabaseHas('members', [
            'class_id' => $classId,
            'school_id' => $schoolId,
            'email' => 'maja.owner@example.test',
            'birthday' => '2007-05-14',
            'role' => 'owner',
            'status' => 'active',
            'privacy_version' => '2026-05-11',
        ]);
        $this->assertDatabaseHas('classes', [
            'id' => $classId,
            'graduation_date' => '2026-06-29',
        ]);
        $this->assertDatabaseMissing('events', [
            'class_id' => $classId,
            'title' => 'Dimission',
            'event_date' => '2026-06-29',
        ]);
        $this->assertDatabaseHas('member_auth_tokens', [
            'token_hash' => hash('sha256', $token),
        ]);

        $passwordHash = DB::table('members')->where('email', 'maja.owner@example.test')->value('password_hash');
        $this->assertTrue(Hash::check('hemmeligt123', $passwordHash));
    }

    public function test_app_class_creation_rejects_owner_under_16(): void
    {
        $schoolId = DB::table('classes')->where('id', 'demo-class')->value('school_id');
        $underageBirthday = now()->subYears(16)->addDay()->format('Y-m-d');

        $this->postJson('/api/classes', [
            'schoolId' => $schoolId,
            'className' => '3.U',
            'graduationYear' => '2026',
            'graduationDate' => '2026-06-29',
            'ownerName' => 'Ung Eier',
            'ownerEmail' => 'ung.owner@example.test',
            'ownerBirthday' => $underageBirthday,
            'password' => 'hemmeligt123',
            'passwordConfirmation' => 'hemmeligt123',
            'termsAccepted' => true,
            'privacyAccepted' => true,
            'joinPolicy' => 'approval',
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Du skal være mindst 16 år for at oprette en konto.');

        $this->assertDatabaseMissing('members', [
            'email' => 'ung.owner@example.test',
        ]);
    }

    public function test_join_rejects_member_under_16(): void
    {
        $schoolId = DB::table('classes')->where('id', 'demo-class')->value('school_id');
        $underageBirthday = now()->subYears(16)->addDay()->format('Y-m-d');

        $this->postJson('/api/classes/join', [
            'inviteCode' => 'STU-DEMO26',
            'schoolId' => $schoolId,
            'firstName' => 'Ung',
            'lastName' => 'Elev',
            'email' => 'ung.elev@example.test',
            'birthday' => $underageBirthday,
            'password' => 'hemmeligt123',
            'passwordConfirmation' => 'hemmeligt123',
            'termsAccepted' => true,
            'privacyAccepted' => true,
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Du skal være mindst 16 år for at oprette en konto.');

        $this->assertDatabaseMissing('members', [
            'email' => 'ung.elev@example.test',
        ]);
    }

    public function test_member_profile_update_rejects_birthday_under_16(): void
    {
        $token = $this->issueTestMemberToken('demo-owner');
        $previousBirthday = DB::table('members')->where('id', 'demo-owner')->value('birthday');
        $underageBirthday = now()->subYears(16)->addDay()->format('Y-m-d');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/members/me/profile', [
                'birthday' => $underageBirthday,
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Du skal være mindst 16 år for at oprette en konto.');

        $this->assertSame(
            $previousBirthday,
            DB::table('members')->where('id', 'demo-owner')->value('birthday'),
        );
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

    public function test_existing_member_can_login_without_invite_code_when_email_is_unique(): void
    {
        $loginResponse = $this->postJson('/api/session/login', [
            'email' => 'chris@skole.dk',
            'password' => 'studos123',
        ]);

        $loginResponse
            ->assertStatus(200)
            ->assertJsonPath('session.member.id', 'demo-owner')
            ->assertJsonPath('session.member.email', 'chris@skole.dk')
            ->assertJsonStructure(['session' => ['token', 'tokenType', 'expiresAt', 'member' => ['personalCode']]])
            ->assertJsonPath('class.id', 'demo-class');
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

    public function test_legacy_web_login_and_admin_routes_redirect_home(): void
    {
        $this->get('/login')->assertRedirect('/');
        $this->post('/login', [
            'email' => 'chris@skole.dk',
            'password' => 'studos123',
        ])->assertRedirect('/');
        $this->assertGuest();

        $this->get('/admin')->assertRedirect('/');
        $this->get('/admin/classes/demo-class')->assertRedirect('/');
        $this->patch('/admin/classes/demo-class/settings', [
            'className' => '3.Z',
            'joinPolicy' => 'closed',
        ])->assertRedirect('/');
        $this->delete('/admin/classes/demo-class/members/demo-owner')->assertRedirect('/');
        $this->get('/classes/demo-class')->assertRedirect('/');

        $this->assertDatabaseHas('classes', [
            'id' => 'demo-class',
            'class_name' => '3.B',
            'join_policy' => 'approval',
        ]);
        $this->assertDatabaseHas('members', [
            'id' => 'demo-owner',
            'status' => 'active',
        ]);
    }

    public function test_legacy_web_create_class_route_redirects_home_without_creating_data(): void
    {
        DB::table('schools')->insert([
            'id' => 'test-school',
            'name' => 'Test Gymnasium',
            'name_key' => 'test-gymnasium',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->get('/opret-klasse')->assertRedirect('/');

        $this->post('/opret-klasse', [
            'ownerName' => 'Maja Test',
            'ownerEmail' => 'maja@example.test',
            'password' => 'hemmeligt123',
            'password_confirmation' => 'hemmeligt123',
            'schoolId' => 'test-school',
            'className' => '3.C',
            'graduationYear' => '2026',
            'graduationDate' => '2026-06-25',
            'joinPolicy' => 'approval',
        ])->assertRedirect('/');

        $this->assertGuest();
        $this->assertDatabaseMissing('users', ['email' => 'maja@example.test']);
        $this->assertDatabaseMissing('classes', ['class_name' => '3.C']);
        $this->assertDatabaseMissing('members', ['email' => 'maja@example.test']);
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

    public function test_owner_can_update_class_name_from_api(): void
    {
        $ownerToken = $this->issueTestMemberToken('demo-owner');

        $this->patchJson('/api/classes/demo-class/settings', [
            'className' => '3.Z',
        ], [
            'Authorization' => 'Bearer '.$ownerToken,
        ])
            ->assertStatus(200)
            ->assertJsonPath('class.className', '3.Z');

        $this->assertDatabaseHas('classes', [
            'id' => 'demo-class',
            'class_name' => '3.Z',
        ]);
    }

    public function test_owner_can_update_class_join_policy_from_api(): void
    {
        $ownerToken = $this->issueTestMemberToken('demo-owner');

        $this->patchJson('/api/classes/demo-class/settings', [
            'joinPolicy' => 'closed',
        ], [
            'Authorization' => 'Bearer '.$ownerToken,
        ])
            ->assertStatus(200)
            ->assertJsonPath('class.settings.joinPolicy', 'closed');

        $this->assertDatabaseHas('classes', [
            'id' => 'demo-class',
            'join_policy' => 'closed',
        ]);
    }

    public function test_owner_can_update_class_graduation_date_from_api(): void
    {
        $ownerToken = $this->issueTestMemberToken('demo-owner');

        $this->patchJson('/api/classes/demo-class/settings', [
            'graduationDate' => '2026-06-28',
        ], [
            'Authorization' => 'Bearer '.$ownerToken,
        ])
            ->assertStatus(200)
            ->assertJsonPath('class.graduationDate', '2026-06-28');

        $this->assertDatabaseHas('classes', [
            'id' => 'demo-class',
            'graduation_date' => '2026-06-28',
        ]);
    }

    public function test_moderator_cannot_update_class_name_from_api(): void
    {
        $this->createActiveDemoMember('api-class-settings-moderator', 'API Class Moderator', 'api-class-settings-moderator@example.test');
        DB::table('members')->where('id', 'api-class-settings-moderator')->update(['role' => 'moderator']);

        $moderatorToken = $this->issueTestMemberToken('api-class-settings-moderator');

        $this->patchJson('/api/classes/demo-class/settings', [
            'className' => '3.X',
        ], [
            'Authorization' => 'Bearer '.$moderatorToken,
        ])->assertForbidden();

        $this->assertDatabaseMissing('classes', [
            'id' => 'demo-class',
            'class_name' => '3.X',
        ]);
    }

    public function test_owner_can_send_class_announcement_push_from_api(): void
    {
        $this->createActiveDemoMember('api-class-announcement-member', 'API Announcement', 'api.announcement@example.test');

        $pushToken = 'ExpoPushToken['.Str::random(32).']';
        DB::table('member_push_tokens')->insert([
            'id' => (string) Str::uuid(),
            'member_id' => 'api-class-announcement-member',
            'expo_push_token' => $pushToken,
            'platform' => 'ios',
            'device_name' => 'iPhone Test',
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

        $ownerToken = $this->issueTestMemberToken('demo-owner');

        $response = $this
            ->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->postJson('/api/classes/demo-class/announcements', [
                'title' => 'Vigtig klassebesked',
                'body' => 'Husk fællesmøde i morgen.',
            ]);

        $response
            ->assertStatus(200)
            ->assertJsonPath('ok', true)
            ->assertJsonPath('sent', 1)
            ->assertJsonPath('message', 'Klassebeskeden er sendt.');
        $this->assertGreaterThanOrEqual(1, $response->json('recipientCount'));

        Http::assertSent(function ($request) use ($pushToken): bool {
            $messages = collect($request->data());
            $message = $messages->firstWhere('to', $pushToken);

            return $request->url() === 'https://exp.host/--/api/v2/push/send'
                && $message
                && ($message['title'] ?? '') === 'Vigtig klassebesked'
                && ($message['body'] ?? '') === 'Husk fællesmøde i morgen.'
                && ($message['data']['type'] ?? '') === PushNotifier::CAT_CLASS_ANNOUNCEMENT
                && ($message['data']['screen'] ?? '') === 'overview';
        });
        $this->assertDatabaseHas('notification_dispatch_log', [
            'member_id' => 'api-class-announcement-member',
            'category' => PushNotifier::CAT_CLASS_ANNOUNCEMENT,
            'source_type' => 'class_announcement',
        ]);
    }

    public function test_moderator_cannot_send_class_announcement_from_api(): void
    {
        $this->createActiveDemoMember('api-class-announcement-moderator', 'API Announcement Moderator', 'api.announcement.moderator@example.test');
        DB::table('members')->where('id', 'api-class-announcement-moderator')->update(['role' => 'moderator']);

        $moderatorToken = $this->issueTestMemberToken('api-class-announcement-moderator');

        $this
            ->withHeader('Authorization', 'Bearer '.$moderatorToken)
            ->postJson('/api/classes/demo-class/announcements', [
                'title' => 'Vigtig klassebesked',
                'body' => 'Husk fællesmøde i morgen.',
            ])
            ->assertForbidden();
    }

    public function test_owner_can_invite_pending_class_member_from_api(): void
    {
        $ownerToken = $this->issueTestMemberToken('demo-owner');

        $this->postJson('/api/classes/demo-class/members/invite', [
            'email' => 'api.invited@example.test',
            'role' => 'moderator',
        ], [
            'Authorization' => 'Bearer '.$ownerToken,
        ])
            ->assertCreated()
            ->assertJsonPath('member.role', 'moderator')
            ->assertJsonPath('member.status', 'pending');

        $this->assertDatabaseHas('members', [
            'class_id' => 'demo-class',
            'email' => 'api.invited@example.test',
            'role' => 'moderator',
            'status' => 'pending',
        ]);
        $this->assertNull(DB::table('members')->where('email', 'api.invited@example.test')->value('password_hash'));
    }

    public function test_owner_can_approve_pending_class_member_from_api(): void
    {
        $ownerToken = $this->issueTestMemberToken('demo-owner');

        $inviteResponse = $this->postJson('/api/classes/demo-class/members/invite', [
            'email' => 'api.pending.approve@example.test',
            'role' => 'student',
        ], [
            'Authorization' => 'Bearer '.$ownerToken,
        ])->assertCreated();

        $memberId = $inviteResponse->json('member.id');

        $this->postJson("/api/classes/demo-class/members/{$memberId}/access", [
            'status' => 'active',
        ], [
            'Authorization' => 'Bearer '.$ownerToken,
        ])
            ->assertStatus(200)
            ->assertJsonPath('member.status', 'active');

        $this->assertDatabaseHas('members', [
            'id' => $memberId,
            'status' => 'active',
        ]);
    }

    public function test_owner_role_transfer_demotes_previous_owner(): void
    {
        $this->createActiveDemoMember('api-new-owner', 'API New Owner', 'api-new-owner@example.test');
        $ownerToken = $this->issueTestMemberToken('demo-owner');

        $this->postJson('/api/classes/demo-class/members/api-new-owner/access', [
            'role' => 'owner',
        ], [
            'Authorization' => 'Bearer '.$ownerToken,
        ])
            ->assertStatus(200)
            ->assertJsonPath('member.role', 'owner');

        $this->assertDatabaseHas('members', [
            'id' => 'api-new-owner',
            'role' => 'owner',
        ]);
        $this->assertDatabaseHas('members', [
            'id' => 'demo-owner',
            'role' => 'moderator',
        ]);
        $this->assertSame(1, DB::table('members')->where('class_id', 'demo-class')->where('role', 'owner')->count());
    }

    public function test_owner_cannot_invite_pending_class_owner_from_api(): void
    {
        $ownerToken = $this->issueTestMemberToken('demo-owner');

        $this->postJson('/api/classes/demo-class/members/invite', [
            'email' => 'api.pending-owner@example.test',
            'role' => 'owner',
        ], [
            'Authorization' => 'Bearer '.$ownerToken,
        ])->assertUnprocessable();

        $this->assertDatabaseMissing('members', [
            'email' => 'api.pending-owner@example.test',
        ]);
    }

    public function test_moderator_cannot_invite_class_member_from_api(): void
    {
        $this->createActiveDemoMember('api-invite-moderator', 'API Invite Moderator', 'api-invite-moderator@example.test');
        DB::table('members')->where('id', 'api-invite-moderator')->update(['role' => 'moderator']);

        $moderatorToken = $this->issueTestMemberToken('api-invite-moderator');

        $this->postJson('/api/classes/demo-class/members/invite', [
            'email' => 'api.denied@example.test',
            'role' => 'student',
        ], [
            'Authorization' => 'Bearer '.$moderatorToken,
        ])->assertForbidden();

        $this->assertDatabaseMissing('members', [
            'email' => 'api.denied@example.test',
        ]);
    }

}
