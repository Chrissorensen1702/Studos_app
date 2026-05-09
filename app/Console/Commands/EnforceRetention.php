<?php

namespace App\Console\Commands;

use App\Support\RetentionService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Throwable;

class EnforceRetention extends Command
{
    protected $signature = 'retention:enforce {--dry-run : Vis hvad der ville blive slettet, uden at slette}';

    protected $description = 'Håndhæver dataopbevaringspolitikken (auth-tokens, push-tokens, moderation, audit-log).';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $service = new RetentionService($dryRun);

        $executedAt = Carbon::now('UTC');
        $runId = $service->startRun($executedAt);

        $this->line($dryRun
            ? '🔍  Retention-kørsel (DRY-RUN — ingen data ændres)'
            : '🧹  Retention-kørsel — håndhæver opbevaringspolitikken');
        $this->newLine();

        try {
            $result = $service->runAll();
        } catch (Throwable $exception) {
            $service->finishRun(
                $runId,
                'failed',
                Carbon::now('UTC'),
                ['fatal' => true],
                $exception->getMessage(),
            );

            Log::critical('Retention-kørsel mislykkedes fatalt', [
                'run_id' => $runId,
                'exception' => $exception::class,
                'message' => $exception->getMessage(),
            ]);

            $this->error('Retention-kørsel mislykkedes: '.$exception->getMessage());

            return self::FAILURE;
        }

        $summary = $result['summary'];
        $errors = $result['errors'];
        $hasErrors = ! empty($errors);
        $status = $hasErrors ? 'partial' : 'completed';

        $this->table(
            ['Regel', $dryRun ? 'Ville slette' : 'Slettet', 'Status'],
            collect($summary)->map(function ($count, string $rule) use ($errors): array {
                $status = $count === null ? 'FEJL' : 'OK';
                $countDisplay = $count === null ? '-' : (string) $count;
                $note = $errors[$rule] ?? '';

                return [$rule, $countDisplay, trim($status.' '.$note)];
            })->values()->all(),
        );

        $service->finishRun(
            $runId,
            $status,
            Carbon::now('UTC'),
            $summary,
            $hasErrors ? json_encode($errors, JSON_UNESCAPED_UNICODE) : null,
        );

        Log::info('Retention-kørsel afsluttet', [
            'run_id' => $runId,
            'dry_run' => $dryRun,
            'status' => $status,
            'summary' => $summary,
            'errors' => $errors,
        ]);

        $this->newLine();
        $this->line($hasErrors
            ? '⚠️  Færdig med fejl i én eller flere regler — se logs.'
            : '✅  Færdig.');

        return $hasErrors ? self::FAILURE : self::SUCCESS;
    }
}
