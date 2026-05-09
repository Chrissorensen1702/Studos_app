<?php

namespace Tests\Feature;

use App\Support\PushNotifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class PushNotifierTest extends TestCase
{
    use RefreshDatabase;

    private string $memberId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->memberId = $this->seedMember();
    }

    public function test_send_pushes_to_active_tokens_and_records_dispatch(): void
    {
        $this->insertPushToken(['platform' => 'ios']);
        Http::fake([
            'exp.host/*' => Http::response(['data' => [['status' => 'ok']]], 200),
        ]);

        $sent = PushNotifier::send(PushNotifier::CAT_DUEL_INVITE, [$this->memberId], [
            'title' => 'Ny dyst',
            'body' => 'Du er udfordret.',
            'sourceType' => 'point_duel',
            'sourceId' => 'duel-1',
            'dedupKey' => 'duel_invite:duel-1',
        ]);

        $this->assertSame(1, $sent);
        $this->assertDatabaseHas('notification_dispatch_log', [
            'member_id' => $this->memberId,
            'category' => PushNotifier::CAT_DUEL_INVITE,
            'dedup_key' => 'duel_invite:duel-1',
        ]);
    }

    public function test_send_skips_disabled_tokens(): void
    {
        $this->insertPushToken(['disabled_at' => now()->format('Y-m-d H:i:s')]);
        Http::fake();

        $sent = PushNotifier::send(PushNotifier::CAT_DUEL_INVITE, [$this->memberId], [
            'title' => 'Ny dyst',
            'body' => 'Skal ikke sendes.',
        ]);

        $this->assertSame(0, $sent);
        Http::assertNothingSent();
    }

    public function test_send_respects_disabled_category_preference(): void
    {
        $this->insertPushToken();
        PushNotifier::setPreference($this->memberId, PushNotifier::CAT_DUEL_INVITE, false);
        Http::fake();

        $sent = PushNotifier::send(PushNotifier::CAT_DUEL_INVITE, [$this->memberId], [
            'title' => 'Ny dyst',
            'body' => 'Maa ikke sendes.',
        ]);

        $this->assertSame(0, $sent);
        Http::assertNothingSent();
    }

    public function test_send_dedups_same_dedup_key(): void
    {
        $this->insertPushToken();
        Http::fake([
            'exp.host/*' => Http::response(['data' => [['status' => 'ok']]], 200),
        ]);

        $first = PushNotifier::send(PushNotifier::CAT_DUEL_EXPIRING, [$this->memberId], [
            'title' => 'Udløber snart',
            'body' => 'Om 1 time.',
            'dedupKey' => 'duel_expiring:duel-1',
        ]);
        $second = PushNotifier::send(PushNotifier::CAT_DUEL_EXPIRING, [$this->memberId], [
            'title' => 'Udløber snart',
            'body' => 'Om 1 time.',
            'dedupKey' => 'duel_expiring:duel-1',
        ]);

        $this->assertSame(1, $first);
        $this->assertSame(0, $second);
        $this->assertSame(1, DB::table('notification_dispatch_log')
            ->where('dedup_key', 'duel_expiring:duel-1')
            ->count());
    }

    public function test_send_disables_invalid_tokens_returned_by_expo(): void
    {
        $tokenId = $this->insertPushToken();
        $tokenValue = DB::table('member_push_tokens')->where('id', $tokenId)->value('expo_push_token');

        Http::fake([
            'exp.host/*' => Http::response([
                'data' => [
                    [
                        'status' => 'error',
                        'details' => ['error' => 'DeviceNotRegistered'],
                    ],
                ],
            ], 200),
        ]);

        PushNotifier::send(PushNotifier::CAT_CONNECTION_REQUEST, [$this->memberId], [
            'title' => 'Test',
            'body' => 'Test body',
        ]);

        $disabledAt = DB::table('member_push_tokens')->where('expo_push_token', $tokenValue)->value('disabled_at');
        $this->assertNotNull($disabledAt);
    }

    public function test_set_preference_updates_existing_row(): void
    {
        PushNotifier::setPreference($this->memberId, PushNotifier::CAT_EVENT_INVITE, false);
        PushNotifier::setPreference($this->memberId, PushNotifier::CAT_EVENT_INVITE, true);

        $rows = DB::table('member_notification_preferences')
            ->where('member_id', $this->memberId)
            ->where('category', PushNotifier::CAT_EVENT_INVITE)
            ->get();

        $this->assertCount(1, $rows);
        $this->assertTrue((bool) $rows->first()->enabled);
    }

    public function test_preferences_for_returns_defaults_for_unset_categories(): void
    {
        $prefs = PushNotifier::preferencesFor($this->memberId);

        foreach (PushNotifier::CATEGORIES as $category) {
            $this->assertArrayHasKey($category, $prefs);
            $this->assertTrue($prefs[$category], "Default for {$category} should be true.");
        }
    }

    private function seedMember(): string
    {
        $memberId = (string) Str::uuid();
        $schoolId = DB::table('classes')->where('id', 'demo-class')->value('school_id');

        DB::table('members')->insert([
            'id' => $memberId,
            'class_id' => 'demo-class',
            'school_id' => $schoolId,
            'personal_code' => 'PUSH-'.Str::upper(Str::random(8)),
            'display_name' => 'Push Test '.Str::random(4),
            'first_name' => 'Push',
            'last_name' => 'Test',
            'email' => 'push+'.Str::random(6).'@example.com',
            'role' => 'student',
            'status' => 'active',
            'joined_at' => now(),
        ]);

        return $memberId;
    }

    private function insertPushToken(array $overrides = []): string
    {
        $id = (string) Str::uuid();

        DB::table('member_push_tokens')->insert(array_merge([
            'id' => $id,
            'member_id' => $this->memberId,
            'expo_push_token' => 'ExponentPushToken['.Str::random(20).']',
            'platform' => 'android',
            'device_name' => null,
            'project_id' => null,
            'app_variant' => null,
            'native_application_version' => null,
            'native_build_version' => null,
            'last_registered_at' => now()->format('Y-m-d H:i:s'),
            'disabled_at' => null,
            'created_at' => now()->format('Y-m-d H:i:s'),
            'updated_at' => null,
        ], $overrides));

        return $id;
    }
}
