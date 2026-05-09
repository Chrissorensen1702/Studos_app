<?php

namespace App\Support;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Throwable;

/**
 * Håndhæver dataopbevarings­politikken beskrevet i privatlivspolitikken.
 *
 * Hver retention-regel er en separat metode, der returnerer antallet af
 * berørte rækker. Reglerne kan fejle uafhængigt af hinanden — én fejl
 * stopper ikke de øvrige. Alle kørsler logges til retention_runs til
 * compliance-dokumentation.
 *
 * @see config/retention.php
 */
class RetentionService
{
    private bool $dryRun = false;

    public function __construct(bool $dryRun = false)
    {
        $this->dryRun = $dryRun;
    }

    /**
     * Kør alle retention-regler. Returnerer en sammenfatning egnet til
     * audit-log og CLI-output.
     *
     * @return array{summary: array<string, int|string|null>, errors: array<string, string>}
     */
    public function runAll(): array
    {
        $summary = [];
        $errors = [];

        $rules = [
            'auth_tokens' => fn (): int => $this->pruneAuthTokens(),
            'push_tokens' => fn (): int => $this->prunePushTokens(),
            'moderation_violations' => fn (): int => $this->pruneModerationViolations(),
            'retention_runs' => fn (): int => $this->pruneRetentionRuns(),
        ];

        foreach ($rules as $name => $callable) {
            try {
                $summary[$name] = $callable();
            } catch (Throwable $exception) {
                $summary[$name] = null;
                $errors[$name] = $exception->getMessage();

                Log::error('Retention-regel fejlede', [
                    'rule' => $name,
                    'dry_run' => $this->dryRun,
                    'exception' => $exception::class,
                    'message' => $exception->getMessage(),
                ]);
            }
        }

        return [
            'summary' => $summary,
            'errors' => $errors,
        ];
    }

    /**
     * Sletter auth-tokens, der har overskredet retention-policy.
     *
     * Et token slettes hvis ÉT af følgende er sandt:
     *   - last_used_at er ældre end idle_days
     *   - last_used_at er null OG created_at er ældre end idle_days
     *   - revoked_at er ældre end revoked_grace_days
     */
    public function pruneAuthTokens(): int
    {
        if (! Schema::hasTable('member_auth_tokens')) {
            return 0;
        }

        $idleDays = (int) config('retention.auth_tokens.idle_days', 90);
        $revokedGraceDays = (int) config('retention.auth_tokens.revoked_grace_days', 30);

        $idleCutoff = Carbon::now('UTC')->subDays($idleDays)->format('Y-m-d H:i:s');
        $revokedCutoff = Carbon::now('UTC')->subDays($revokedGraceDays)->format('Y-m-d H:i:s');

        return $this->deleteInBatches(function () use ($idleCutoff, $revokedCutoff) {
            return DB::table('member_auth_tokens')
                ->where(function ($query) use ($idleCutoff): void {
                    $query
                        ->whereNotNull('last_used_at')
                        ->where('last_used_at', '<', $idleCutoff);
                })
                ->orWhere(function ($query) use ($idleCutoff): void {
                    $query
                        ->whereNull('last_used_at')
                        ->where('created_at', '<', $idleCutoff);
                })
                ->orWhere(function ($query) use ($revokedCutoff): void {
                    $query
                        ->whereNotNull('revoked_at')
                        ->where('revoked_at', '<', $revokedCutoff);
                });
        });
    }

    /**
     * Sletter push-tokens, der enten er deaktiverede længe eller har
     * stoppet med at blive re-registreret.
     */
    public function prunePushTokens(): int
    {
        if (! Schema::hasTable('member_push_tokens')) {
            return 0;
        }

        $disabledGraceDays = (int) config('retention.push_tokens.disabled_grace_days', 30);
        $unusedDays = (int) config('retention.push_tokens.unused_days', 365);

        $disabledCutoff = Carbon::now('UTC')->subDays($disabledGraceDays)->format('Y-m-d H:i:s');
        $unusedCutoff = Carbon::now('UTC')->subDays($unusedDays)->format('Y-m-d H:i:s');

        return $this->deleteInBatches(function () use ($disabledCutoff, $unusedCutoff) {
            return DB::table('member_push_tokens')
                ->where(function ($query) use ($disabledCutoff): void {
                    $query
                        ->whereNotNull('disabled_at')
                        ->where('disabled_at', '<', $disabledCutoff);
                })
                ->orWhere(function ($query) use ($unusedCutoff): void {
                    $query->where('last_registered_at', '<', $unusedCutoff);
                });
        });
    }

    /**
     * Sletter moderationsdata, der er ældre end retention-perioden.
     */
    public function pruneModerationViolations(): int
    {
        if (! Schema::hasTable('moderation_violations')) {
            return 0;
        }

        $retentionDays = (int) config('retention.moderation_violations.retention_days', 730);
        $cutoff = Carbon::now('UTC')->subDays($retentionDays)->format('Y-m-d H:i:s');

        return $this->deleteInBatches(function () use ($cutoff) {
            return DB::table('moderation_violations')
                ->where('created_at', '<', $cutoff);
        });
    }

    /**
     * Sletter gamle audit-rækker fra denne tabel selv. Vi opbevarer dem
     * i en længere periode (5 år) som administrativ god skik.
     */
    public function pruneRetentionRuns(): int
    {
        if (! Schema::hasTable('retention_runs')) {
            return 0;
        }

        $keepDays = (int) config('retention.retention_runs.keep_days', 1825);
        $cutoff = Carbon::now('UTC')->subDays($keepDays)->format('Y-m-d H:i:s');

        return $this->deleteInBatches(function () use ($cutoff) {
            return DB::table('retention_runs')
                ->where('executed_at', '<', $cutoff);
        });
    }

    /**
     * Opretter en audit-række ved start af en kørsel.
     */
    public function startRun(Carbon $executedAt): string
    {
        if (! Schema::hasTable('retention_runs')) {
            return '';
        }

        $id = (string) Str::uuid();

        DB::table('retention_runs')->insert([
            'id' => $id,
            'executed_at' => $executedAt->format('Y-m-d H:i:s'),
            'completed_at' => null,
            'status' => 'running',
            'dry_run' => $this->dryRun,
            'summary' => null,
            'error' => null,
        ]);

        return $id;
    }

    /**
     * Opdaterer audit-rækken med endelig status.
     */
    public function finishRun(
        string $runId,
        string $status,
        Carbon $completedAt,
        array $summary,
        ?string $error = null,
    ): void {
        if (blank($runId) || ! Schema::hasTable('retention_runs')) {
            return;
        }

        DB::table('retention_runs')->where('id', $runId)->update([
            'completed_at' => $completedAt->format('Y-m-d H:i:s'),
            'status' => $status,
            'summary' => json_encode($summary, JSON_UNESCAPED_UNICODE),
            'error' => $error,
        ]);
    }

    public function isDryRun(): bool
    {
        return $this->dryRun;
    }

    /**
     * Udfører en sletning i batches. I dry-run-tilstand returneres alene
     * antallet, der ville være blevet slettet — uden at røre data.
     *
     * Batching forhindrer lange tabel-låse på store datasæt.
     *
     * @param  callable(): \Illuminate\Database\Query\Builder  $queryFactory
     */
    private function deleteInBatches(callable $queryFactory): int
    {
        $batchSize = (int) config('retention.batch_size', 1000);
        $totalAffected = 0;

        if ($this->dryRun) {
            return (int) $queryFactory()->count();
        }

        while (true) {
            $deleted = $queryFactory()->limit($batchSize)->delete();

            if ($deleted === 0) {
                break;
            }

            $totalAffected += $deleted;

            if ($deleted < $batchSize) {
                break;
            }
        }

        return $totalAffected;
    }
}
