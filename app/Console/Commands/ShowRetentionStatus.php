<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ShowRetentionStatus extends Command
{
    protected $signature = 'retention:status {--limit=14 : Antal seneste kørsler der vises}';

    protected $description = 'Viser status for de seneste retention-kørsler. Bruges til hurtigt sundhedscheck og compliance-audit.';

    public function handle(): int
    {
        if (! Schema::hasTable('retention_runs')) {
            $this->error('Tabellen retention_runs findes ikke — kør php artisan migrate.');

            return self::FAILURE;
        }

        $limit = max(1, (int) $this->option('limit'));

        $runs = DB::table('retention_runs')
            ->orderByDesc('executed_at')
            ->limit($limit)
            ->get();

        if ($runs->isEmpty()) {
            $this->warn('Ingen retention-kørsler registreret endnu.');

            return self::SUCCESS;
        }

        $latest = $runs->first();
        $latestExecuted = Carbon::parse($latest->executed_at, 'UTC');
        $hoursSinceLatest = $latestExecuted->diffInHours(Carbon::now('UTC'));

        $this->newLine();
        $this->line('<info>Status — seneste kørsel</info>');
        $this->line('  Tidspunkt:  '.$latest->executed_at.' UTC');
        $this->line('  Status:     '.$this->formatStatus($latest->status));
        $this->line('  Type:       '.($latest->dry_run ? 'dry-run' : 'live'));

        if ($hoursSinceLatest > 25 && ! $latest->dry_run) {
            $this->line('  ⚠️  Advarsel: Seneste live-kørsel er '.$hoursSinceLatest.' timer gammel — schedule kører måske ikke.');
        }

        $this->newLine();
        $this->line('<info>Sidste '.$runs->count().' kørsler</info>');

        $this->table(
            ['Tidspunkt (UTC)', 'Status', 'Dry', 'Auth', 'Push', 'Mod', 'RR', 'Fejl'],
            $runs->map(function (object $row): array {
                $summary = json_decode($row->summary ?? '{}', true) ?: [];

                return [
                    $row->executed_at,
                    $this->formatStatus($row->status),
                    $row->dry_run ? 'ja' : 'nej',
                    $this->formatCount($summary['auth_tokens'] ?? null),
                    $this->formatCount($summary['push_tokens'] ?? null),
                    $this->formatCount($summary['moderation_violations'] ?? null),
                    $this->formatCount($summary['retention_runs'] ?? null),
                    blank($row->error) ? '' : '⚠',
                ];
            })->all(),
        );

        $failed = $runs->where('status', 'failed')->count();
        $partial = $runs->where('status', 'partial')->count();

        if ($failed > 0 || $partial > 0) {
            $this->newLine();
            $this->warn(sprintf(
                'Bemærk: %d failed og %d partial kørsler i denne periode. Tjek logs eller kør "php artisan retention:status" med større --limit.',
                $failed,
                $partial,
            ));

            return self::FAILURE;
        }

        return self::SUCCESS;
    }

    private function formatStatus(string $status): string
    {
        return match ($status) {
            'completed' => '<fg=green>completed</>',
            'running' => '<fg=yellow>running</>',
            'partial' => '<fg=yellow>partial</>',
            'failed' => '<fg=red>failed</>',
            default => $status,
        };
    }

    private function formatCount(int|string|null $value): string
    {
        if ($value === null) {
            return '-';
        }

        return (string) $value;
    }
}
