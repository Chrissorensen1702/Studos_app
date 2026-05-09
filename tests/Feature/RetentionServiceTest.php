<?php

namespace Tests\Feature;

use App\Support\RetentionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class RetentionServiceTest extends TestCase
{
    use RefreshDatabase;

    private string $memberId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->memberId = $this->seedMember();
    }

    public function test_prunes_auth_tokens_with_stale_last_used_at(): void
    {
        $staleId = $this->insertAuthToken(['last_used_at' => $this->daysAgo(91)]);
        $freshId = $this->insertAuthToken(['last_used_at' => $this->daysAgo(10)]);

        $deleted = (new RetentionService())->pruneAuthTokens();

        $this->assertSame(1, $deleted);
        $this->assertDatabaseMissing('member_auth_tokens', ['id' => $staleId]);
        $this->assertDatabaseHas('member_auth_tokens', ['id' => $freshId]);
    }

    public function test_prunes_auth_tokens_never_used_but_old(): void
    {
        $unusedOld = $this->insertAuthToken([
            'last_used_at' => null,
            'created_at' => $this->daysAgo(120),
        ]);
        $unusedFresh = $this->insertAuthToken([
            'last_used_at' => null,
            'created_at' => $this->daysAgo(5),
        ]);

        $deleted = (new RetentionService())->pruneAuthTokens();

        $this->assertSame(1, $deleted);
        $this->assertDatabaseMissing('member_auth_tokens', ['id' => $unusedOld]);
        $this->assertDatabaseHas('member_auth_tokens', ['id' => $unusedFresh]);
    }

    public function test_prunes_auth_tokens_revoked_past_grace_period(): void
    {
        $revokedOld = $this->insertAuthToken([
            'last_used_at' => $this->daysAgo(5),
            'revoked_at' => $this->daysAgo(45),
        ]);
        $revokedRecent = $this->insertAuthToken([
            'last_used_at' => $this->daysAgo(5),
            'revoked_at' => $this->daysAgo(10),
        ]);

        $deleted = (new RetentionService())->pruneAuthTokens();

        $this->assertSame(1, $deleted);
        $this->assertDatabaseMissing('member_auth_tokens', ['id' => $revokedOld]);
        $this->assertDatabaseHas('member_auth_tokens', ['id' => $revokedRecent]);
    }

    public function test_prunes_push_tokens_disabled_past_grace_period(): void
    {
        $disabledOld = $this->insertPushToken([
            'disabled_at' => $this->daysAgo(45),
        ]);
        $disabledRecent = $this->insertPushToken([
            'disabled_at' => $this->daysAgo(10),
        ]);

        $deleted = (new RetentionService())->prunePushTokens();

        $this->assertSame(1, $deleted);
        $this->assertDatabaseMissing('member_push_tokens', ['id' => $disabledOld]);
        $this->assertDatabaseHas('member_push_tokens', ['id' => $disabledRecent]);
    }

    public function test_prunes_push_tokens_unused_for_a_year(): void
    {
        $unusedOld = $this->insertPushToken([
            'last_registered_at' => $this->daysAgo(400),
        ]);
        $unusedRecent = $this->insertPushToken([
            'last_registered_at' => $this->daysAgo(30),
        ]);

        $deleted = (new RetentionService())->prunePushTokens();

        $this->assertSame(1, $deleted);
        $this->assertDatabaseMissing('member_push_tokens', ['id' => $unusedOld]);
        $this->assertDatabaseHas('member_push_tokens', ['id' => $unusedRecent]);
    }

    public function test_prunes_moderation_violations_older_than_24_months(): void
    {
        $oldId = $this->insertModerationViolation(['created_at' => $this->daysAgo(800)]);
        $recentId = $this->insertModerationViolation(['created_at' => $this->daysAgo(30)]);

        $deleted = (new RetentionService())->pruneModerationViolations();

        $this->assertSame(1, $deleted);
        $this->assertDatabaseMissing('moderation_violations', ['id' => $oldId]);
        $this->assertDatabaseHas('moderation_violations', ['id' => $recentId]);
    }

    public function test_prunes_retention_runs_older_than_keep_days(): void
    {
        $service = new RetentionService();
        $oldRunId = $this->insertRetentionRun(['executed_at' => $this->daysAgo(2000)]);
        $recentRunId = $this->insertRetentionRun(['executed_at' => $this->daysAgo(30)]);

        $deleted = $service->pruneRetentionRuns();

        $this->assertSame(1, $deleted);
        $this->assertDatabaseMissing('retention_runs', ['id' => $oldRunId]);
        $this->assertDatabaseHas('retention_runs', ['id' => $recentRunId]);
    }

    public function test_dry_run_counts_without_deleting(): void
    {
        $staleId = $this->insertAuthToken(['last_used_at' => $this->daysAgo(120)]);

        $service = new RetentionService(dryRun: true);
        $count = $service->pruneAuthTokens();

        $this->assertSame(1, $count);
        $this->assertDatabaseHas('member_auth_tokens', ['id' => $staleId]);
        $this->assertTrue($service->isDryRun());
    }

    public function test_run_all_returns_summary_for_each_rule(): void
    {
        $this->insertAuthToken(['last_used_at' => $this->daysAgo(120)]);
        $this->insertModerationViolation(['created_at' => $this->daysAgo(800)]);

        $result = (new RetentionService())->runAll();

        $this->assertEqualsCanonicalizing(
            ['auth_tokens', 'push_tokens', 'moderation_violations', 'retention_runs'],
            array_keys($result['summary']),
        );
        $this->assertSame(1, $result['summary']['auth_tokens']);
        $this->assertSame(0, $result['summary']['push_tokens']);
        $this->assertSame(1, $result['summary']['moderation_violations']);
        $this->assertEmpty($result['errors']);
    }

    public function test_run_all_isolates_failures_per_rule(): void
    {
        config()->set('retention.auth_tokens.idle_days', 'not-an-integer');

        $this->insertModerationViolation(['created_at' => $this->daysAgo(800)]);

        $result = (new RetentionService())->runAll();

        // moderation rule should still complete
        $this->assertSame(1, $result['summary']['moderation_violations']);
    }

    public function test_start_and_finish_run_writes_single_audit_row(): void
    {
        $service = new RetentionService();

        $runId = $service->startRun(Carbon::now('UTC'));
        $this->assertNotEmpty($runId);
        $this->assertDatabaseHas('retention_runs', [
            'id' => $runId,
            'status' => 'running',
        ]);

        $service->finishRun(
            $runId,
            'completed',
            Carbon::now('UTC'),
            ['auth_tokens' => 5],
        );

        $this->assertSame(1, DB::table('retention_runs')->where('id', $runId)->count());
        $row = DB::table('retention_runs')->where('id', $runId)->first();
        $this->assertSame('completed', $row->status);
        $this->assertNotNull($row->completed_at);
        $this->assertSame(['auth_tokens' => 5], json_decode($row->summary, true));
    }

    public function test_deletes_in_multiple_batches(): void
    {
        config()->set('retention.batch_size', 2);

        for ($i = 0; $i < 5; $i++) {
            $this->insertAuthToken(['last_used_at' => $this->daysAgo(120)]);
        }

        $deleted = (new RetentionService())->pruneAuthTokens();

        $this->assertSame(5, $deleted);
        $this->assertSame(0, DB::table('member_auth_tokens')->count());
    }

    public function test_command_dry_run_does_not_delete(): void
    {
        $staleId = $this->insertAuthToken(['last_used_at' => $this->daysAgo(120)]);

        $this->artisan('retention:enforce', ['--dry-run' => true])
            ->assertSuccessful();

        $this->assertDatabaseHas('member_auth_tokens', ['id' => $staleId]);
        $this->assertDatabaseHas('retention_runs', [
            'status' => 'completed',
            'dry_run' => 1,
        ]);
    }

    public function test_command_real_run_deletes_and_records_audit(): void
    {
        $staleId = $this->insertAuthToken(['last_used_at' => $this->daysAgo(120)]);

        $this->artisan('retention:enforce')->assertSuccessful();

        $this->assertDatabaseMissing('member_auth_tokens', ['id' => $staleId]);

        $audit = DB::table('retention_runs')
            ->where('status', 'completed')
            ->where('dry_run', 0)
            ->orderByDesc('executed_at')
            ->first();

        $this->assertNotNull($audit);
        $this->assertNotNull($audit->completed_at);

        $summary = json_decode($audit->summary, true);
        $this->assertSame(1, $summary['auth_tokens']);
    }

    public function test_status_command_warns_when_no_runs_recorded(): void
    {
        $this->artisan('retention:status')
            ->expectsOutputToContain('Ingen retention-kørsler registreret endnu.')
            ->assertSuccessful();
    }

    public function test_status_command_lists_recent_runs(): void
    {
        $this->insertRetentionRun([
            'executed_at' => Carbon::now('UTC')->subHour()->format('Y-m-d H:i:s'),
            'completed_at' => Carbon::now('UTC')->subHour()->format('Y-m-d H:i:s'),
            'status' => 'completed',
            'dry_run' => false,
            'summary' => json_encode([
                'auth_tokens' => 3,
                'push_tokens' => 0,
                'moderation_violations' => 0,
                'retention_runs' => 0,
            ]),
        ]);

        $this->artisan('retention:status')
            ->expectsOutputToContain('completed')
            ->assertSuccessful();
    }

    public function test_status_command_returns_failure_when_recent_runs_failed(): void
    {
        $this->insertRetentionRun([
            'executed_at' => Carbon::now('UTC')->subMinutes(30)->format('Y-m-d H:i:s'),
            'completed_at' => Carbon::now('UTC')->subMinutes(30)->format('Y-m-d H:i:s'),
            'status' => 'failed',
            'dry_run' => false,
            'summary' => json_encode([]),
            'error' => 'Database unavailable',
        ]);

        $this->artisan('retention:status')->assertFailed();
    }

    private function seedMember(): string
    {
        $memberId = (string) Str::uuid();
        $schoolId = DB::table('classes')->where('id', 'demo-class')->value('school_id');

        DB::table('members')->insert([
            'id' => $memberId,
            'class_id' => 'demo-class',
            'school_id' => $schoolId,
            'personal_code' => 'TEST-'.Str::upper(Str::random(8)),
            'display_name' => 'Retention Test '.Str::random(4),
            'first_name' => 'Retention',
            'last_name' => 'Test',
            'email' => 'retention+'.Str::random(6).'@example.com',
            'role' => 'student',
            'status' => 'active',
            'joined_at' => now(),
        ]);

        return $memberId;
    }

    private function insertAuthToken(array $overrides = []): string
    {
        $id = (string) Str::uuid();

        DB::table('member_auth_tokens')->insert(array_merge([
            'id' => $id,
            'member_id' => $this->memberId,
            'token_hash' => hash('sha256', Str::random(40)),
            'name' => 'test',
            'last_used_at' => null,
            'expires_at' => null,
            'revoked_at' => null,
            'created_at' => now()->format('Y-m-d H:i:s'),
        ], $overrides));

        return $id;
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

    private function insertModerationViolation(array $overrides = []): string
    {
        $id = (string) Str::uuid();
        $now = now()->format('Y-m-d H:i:s');

        DB::table('moderation_violations')->insert(array_merge([
            'id' => $id,
            'member_id' => $this->memberId,
            'class_id' => null,
            'source' => 'test',
            'field' => 'message',
            'violation_type' => 'profanity',
            'matched_term' => null,
            'action' => 'blocked',
            'input_hash' => hash('sha256', Str::random(20)),
            'preview' => null,
            'metadata' => null,
            'ip_address' => null,
            'user_agent' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ], $overrides));

        return $id;
    }

    private function insertRetentionRun(array $overrides = []): string
    {
        $id = (string) Str::uuid();

        DB::table('retention_runs')->insert(array_merge([
            'id' => $id,
            'executed_at' => now()->format('Y-m-d H:i:s'),
            'completed_at' => now()->format('Y-m-d H:i:s'),
            'status' => 'completed',
            'dry_run' => false,
            'summary' => json_encode([]),
            'error' => null,
        ], $overrides));

        return $id;
    }

    private function daysAgo(int $days): string
    {
        return Carbon::now('UTC')->subDays($days)->format('Y-m-d H:i:s');
    }
}
