<?php

use App\Support\PointDuelMaintenance;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('duels:expire', function () {
    $count = PointDuelMaintenance::expireAllDue();

    $this->info("Expired {$count} due point ".($count === 1 ? 'duel' : 'duels').'.');
})->purpose('Expire due point duels and return escrowed Caps');

Schedule::command('duels:expire')->everyMinute()->withoutOverlapping();
