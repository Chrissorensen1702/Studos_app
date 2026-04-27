<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class ContentModeration
{
    public static function cleanText(?string $value, string $field, string $label = 'Teksten', array $context = []): string
    {
        $trimmed = trim((string) $value);

        self::assertAllowed($trimmed, $field, $label, false, $context);

        return $trimmed;
    }

    public static function cleanNullableText(?string $value, string $field, string $label = 'Teksten', array $context = []): ?string
    {
        $trimmed = trim((string) $value);

        if ($trimmed === '') {
            return null;
        }

        return self::cleanText($trimmed, $field, $label, $context);
    }

    public static function cleanName(?string $value, string $field, string $label = 'Navnet', array $context = []): string
    {
        $trimmed = trim((string) $value);

        self::assertAllowed($trimmed, $field, $label, true, $context);

        return $trimmed;
    }

    private static function assertAllowed(string $value, string $field, string $label, bool $isName, array $context): void
    {
        if (! config('studos_moderation.enabled', true) || $value === '') {
            return;
        }

        if ($isName && self::containsContactInfo($value)) {
            self::logViolation($value, $field, 'contact_info', null, $context);

            throw ValidationException::withMessages([
                $field => $label.' maa ikke indeholde links, email eller telefonnummer.',
            ]);
        }

        $reservedTerm = $isName ? self::matchedReservedNameTerm($value) : null;

        if ($reservedTerm) {
            self::logViolation($value, $field, 'reserved_name', $reservedTerm, $context);

            throw ValidationException::withMessages([
                $field => $label.' kan ikke bruges i Studos.',
            ]);
        }

        $blockedTerm = self::matchedBlockedTerm($value);

        if ($blockedTerm) {
            self::logViolation($value, $field, $blockedTerm['type'], $blockedTerm['term'], $context);

            throw ValidationException::withMessages([
                $field => $label.' indeholder et ord, der ikke er tilladt i Studos.',
            ]);
        }
    }

    private static function containsContactInfo(string $value): bool
    {
        return preg_match('/(?:https?:\/\/|www\.|@|[0-9][0-9\s().-]{5,}[0-9])/i', $value) === 1;
    }

    private static function matchedReservedNameTerm(string $value): ?string
    {
        foreach (config('studos_moderation.reserved_name_terms', []) as $term) {
            if (self::containsTerm($value, (string) $term, false)) {
                return (string) $term;
            }
        }

        return null;
    }

    private static function matchedBlockedTerm(string $value): ?array
    {
        foreach (config('studos_moderation.blocked_terms', []) as $term) {
            if (self::containsTerm($value, (string) $term, false)) {
                return [
                    'type' => 'blocked_term',
                    'term' => (string) $term,
                ];
            }
        }

        foreach (config('studos_moderation.compact_blocked_terms', []) as $term) {
            if (self::containsTerm($value, (string) $term, true)) {
                return [
                    'type' => 'compact_blocked_term',
                    'term' => (string) $term,
                ];
            }
        }

        return null;
    }

    private static function logViolation(string $value, string $field, string $type, ?string $matchedTerm, array $context): void
    {
        try {
            if (! Schema::hasTable('moderation_violations')) {
                return;
            }

            $now = now()->format('Y-m-d H:i:s');
            $metadata = collect($context)
                ->except(['member_id', 'class_id', 'source', 'ip_address', 'user_agent'])
                ->filter(fn ($value): bool => ! blank($value))
                ->all();

            DB::table('moderation_violations')->insert([
                'id' => (string) Str::uuid(),
                'member_id' => $context['member_id'] ?? null,
                'class_id' => $context['class_id'] ?? null,
                'source' => $context['source'] ?? 'unknown',
                'field' => $field,
                'violation_type' => $type,
                'matched_term' => $matchedTerm,
                'action' => $context['action'] ?? 'blocked',
                'input_hash' => hash('sha256', $value),
                'preview' => Str::limit(self::safePreview($value), 240, ''),
                'metadata' => $metadata ? json_encode($metadata, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : null,
                'ip_address' => $context['ip_address'] ?? null,
                'user_agent' => $context['user_agent'] ?? null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        } catch (Throwable $error) {
            Log::warning('Moderation violation could not be logged.', [
                'field' => $field,
                'type' => $type,
                'source' => $context['source'] ?? 'unknown',
                'error' => $error->getMessage(),
            ]);
        }
    }

    private static function safePreview(string $value): string
    {
        $trimmed = trim(preg_replace('/\s+/', ' ', $value) ?? $value);

        return preg_replace('/(?:https?:\/\/\S+|www\.\S+|[^\s@]+@[^\s@]+\.[^\s@]+|[0-9][0-9\s().-]{5,}[0-9])/', '[fjernet]', $trimmed) ?? $trimmed;
    }

    private static function containsTerm(string $value, string $term, bool $allowCompact): bool
    {
        [$spaced, $compact] = self::normalize($value);
        [$termSpaced, $termCompact] = self::normalize($term);

        if ($termSpaced === '') {
            return false;
        }

        if (Str::contains($termSpaced, ' ')) {
            return Str::contains(' '.$spaced.' ', ' '.$termSpaced.' ')
                || ($allowCompact && $termCompact !== '' && Str::contains($compact, $termCompact));
        }

        $boundaryPattern = '/(?:^|[^a-z0-9])'.preg_quote($termSpaced, '/').'(?:$|[^a-z0-9])/';

        if (preg_match($boundaryPattern, ' '.$spaced.' ') === 1) {
            return true;
        }

        return $allowCompact && $termCompact !== '' && Str::contains($compact, $termCompact);
    }

    private static function normalize(string $value): array
    {
        $text = Str::lower(Str::ascii($value));
        $text = strtr($text, [
            '0' => 'o',
            '1' => 'i',
            '3' => 'e',
            '4' => 'a',
            '5' => 's',
            '7' => 't',
            '@' => 'a',
            '$' => 's',
            '!' => 'i',
        ]);
        $spaced = preg_replace('/[^a-z0-9]+/u', ' ', $text) ?? '';
        $spaced = trim(preg_replace('/\s+/', ' ', $spaced) ?? '');
        $compact = preg_replace('/[^a-z0-9]+/u', '', $text) ?? '';

        return [$spaced, $compact];
    }
}
