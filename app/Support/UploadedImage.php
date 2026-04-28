<?php

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class UploadedImage
{
    private const MAX_BYTES = 4 * 1024 * 1024;

    public static function storeBase64(
        string $imageData,
        string $folder,
        string $filenamePrefix,
        string $logContext = 'Image',
    ): string {
        if (! preg_match('/^data:image\/(jpeg|jpg|png|webp);base64,/', $imageData)) {
            abort(422, 'Billedet kunne ikke laeses.');
        }

        $base64 = substr($imageData, strpos($imageData, ',') + 1);
        $binary = base64_decode($base64, true);

        if ($binary === false) {
            abort(422, 'Billedet kunne ikke laeses.');
        }

        if (strlen($binary) > self::MAX_BYTES) {
            abort(422, 'Billedet er for stort.');
        }

        $imageInfo = @getimagesizefromstring($binary);
        $mimeType = $imageInfo['mime'] ?? null;
        $extension = match ($mimeType) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            default => null,
        };

        if (! $extension) {
            abort(422, 'Billedet kunne ikke laeses.');
        }

        $filename = $filenamePrefix.'-'.Str::uuid().'.'.$extension;
        $path = 'uploads/'.$folder.'/'.$filename;
        $diskName = self::uploadDiskName();

        try {
            $written = Storage::disk($diskName)->put($path, $binary, [
                'visibility' => 'public',
                'ContentType' => $mimeType,
            ]);
        } catch (Throwable $exception) {
            Log::warning($logContext.' upload failed.', [
                'disk' => $diskName,
                'folder' => $folder,
                'error' => $exception->getMessage(),
            ]);

            abort(500, 'Billedet kunne ikke gemmes. Proev igen om lidt.');
        }

        if ($written === false) {
            Log::warning($logContext.' upload returned false.', [
                'disk' => $diskName,
                'folder' => $folder,
            ]);

            abort(500, 'Billedet kunne ikke gemmes. Proev igen om lidt.');
        }

        return $path;
    }

    public static function publicUrl(?string $value, ?Request $request = null): ?string
    {
        if (blank($value)) {
            return null;
        }

        $value = trim($value);
        $path = self::storagePathFromValue($value);

        if ($path) {
            $diskName = self::uploadDiskName();

            if (
                ! self::isAbsoluteUrl($value)
                || self::usesCloudStorage($diskName)
                || Storage::disk($diskName)->exists($path)
            ) {
                return self::absoluteStorageUrl($diskName, $path, $request);
            }
        }

        if (self::isAbsoluteUrl($value)) {
            return $value;
        }

        if (Str::startsWith($value, '/')) {
            return self::absoluteUrl($value, $request);
        }

        return $value;
    }

    public static function uploadDiskName(): string
    {
        $defaultDisk = (string) config('filesystems.default', 'local');

        if ($defaultDisk === 'local') {
            return 'public';
        }

        $driver = config('filesystems.disks.'.$defaultDisk.'.driver');

        if ($driver === 's3' && ! self::usesCloudStorage($defaultDisk)) {
            return 'public';
        }

        return $defaultDisk;
    }

    public static function storagePathFromValue(?string $value): ?string
    {
        if (blank($value)) {
            return null;
        }

        $value = trim($value);
        $path = self::isAbsoluteUrl($value)
            ? parse_url($value, PHP_URL_PATH)
            : $value;

        if (! is_string($path) || $path === '') {
            return null;
        }

        $path = rawurldecode($path);
        $path = ltrim($path, '/');

        if (Str::startsWith($path, 'storage/uploads/')) {
            return Str::after($path, 'storage/');
        }

        if (Str::startsWith($path, 'uploads/')) {
            return $path;
        }

        if (str_contains($path, '/uploads/')) {
            return 'uploads/'.Str::after($path, '/uploads/');
        }

        return null;
    }

    private static function absoluteStorageUrl(string $diskName, string $path, ?Request $request): string
    {
        if (self::usesCloudStorage($diskName)) {
            try {
                return Storage::disk($diskName)->temporaryUrl($path, now()->addHours(12));
            } catch (Throwable) {
                // Public buckets/CDNs can still use the normal disk URL.
            }
        }

        if (config('filesystems.disks.'.$diskName.'.driver') === 'local') {
            return self::absoluteUrl('/storage/'.$path, $request);
        }

        return self::absoluteUrl(Storage::disk($diskName)->url($path), $request);
    }

    private static function absoluteUrl(string $url, ?Request $request): string
    {
        if (self::isAbsoluteUrl($url)) {
            return $url;
        }

        $request ??= request();

        return $request->getSchemeAndHttpHost()
            .rtrim($request->getBaseUrl(), '/')
            .'/'.ltrim($url, '/');
    }

    private static function isAbsoluteUrl(string $value): bool
    {
        return Str::startsWith($value, ['http://', 'https://']);
    }

    private static function usesCloudStorage(string $diskName): bool
    {
        return app()->environment('production')
            && config('filesystems.disks.'.$diskName.'.driver') === 's3'
            && filled(config('filesystems.disks.'.$diskName.'.bucket'));
    }
}
