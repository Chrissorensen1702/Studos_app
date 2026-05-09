<?php

/*
|--------------------------------------------------------------------------
| Data Retention Policy
|--------------------------------------------------------------------------
|
| Centralt ét sted at definere alle opbevaringsperioder, så
| privatlivspolitikken og den faktiske håndhævelse altid er i sync.
| Værdierne afspejler de løfter, der gives i resources/views/legal/privacy.blade.php.
|
| Ændringer her skal afspejles i privatlivspolitikken og omvendt.
|
*/

return [

    /*
    |--------------------------------------------------------------------------
    | Auth tokens (member_auth_tokens)
    |--------------------------------------------------------------------------
    | Politik: "Op til 90 dage efter sidste brug".
    |
    | Vi sletter rækken når én af følgende er sande:
    |   - last_used_at er ældre end auth_tokens.idle_days
    |   - last_used_at er null OG created_at er ældre end auth_tokens.idle_days
    |   - revoked_at er ældre end auth_tokens.revoked_grace_days
    */
    'auth_tokens' => [
        'idle_days' => 90,
        'revoked_grace_days' => 30,
    ],

    /*
    |--------------------------------------------------------------------------
    | Push tokens (member_push_tokens)
    |--------------------------------------------------------------------------
    | Politik: "Slettes når du slår notifikationer fra eller sletter kontoen".
    |
    | Sletteflowet håndteres direkte i app-koden. Her rydder vi op i:
    |   - Tokens deaktiveret for længere tid siden
    |   - Tokens der ikke er blevet re-registreret i lang tid (sandsynligvis døde)
    */
    'push_tokens' => [
        'disabled_grace_days' => 30,
        'unused_days' => 365,
    ],

    /*
    |--------------------------------------------------------------------------
    | Moderation violations (moderation_violations)
    |--------------------------------------------------------------------------
    | Politik: "Op til 24 måneder af hensyn til misbrugsforebyggelse og
    | DSA-dokumentationspligt, derefter pseudonymiseres yderligere eller slettes".
    */
    'moderation_violations' => [
        'retention_days' => 730,
    ],

    /*
    |--------------------------------------------------------------------------
    | Login codes (engangskoder)
    |--------------------------------------------------------------------------
    | Politik: "15 minutter".
    |
    | Login codes lagres i Laravel Cache med 10-min TTL ved udstedelse, jf.
    | StudosController::sendLoginCode(). Cache-laget håndterer udløb
    | automatisk — ingen aktiv oprydning er nødvendig.
    |
    | Værdien her er kun til dokumentation.
    */
    'login_codes' => [
        'ttl_minutes' => 10,
    ],

    /*
    |--------------------------------------------------------------------------
    | Server logs
    |--------------------------------------------------------------------------
    | Politik: "Op til 30 dage".
    |
    | Håndhæves via Laravel's `daily` log-channel med rotation. Sæt
    | LOG_STACK=daily og LOG_DAILY_DAYS=30 i .env.
    */
    'server_logs' => [
        'days' => 30,
    ],

    /*
    |--------------------------------------------------------------------------
    | Audit log (retention_runs)
    |--------------------------------------------------------------------------
    | Vi gemmer rapporter om retention-kørsler som compliance-dokumentation.
    | Bevares i 5 år som almindelig administrativ god skik.
    */
    'retention_runs' => [
        'keep_days' => 1825,
    ],

    /*
    |--------------------------------------------------------------------------
    | Batch size
    |--------------------------------------------------------------------------
    | Hvor mange rækker, der slettes pr. runde i hver oprydningsregel.
    | Forhindrer lange tabel-låse på store datasæt.
    */
    'batch_size' => 1000,

];
