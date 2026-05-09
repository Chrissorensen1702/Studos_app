<?php

use App\Support\NotificationScheduler;
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

Schedule::command('retention:enforce')
    ->dailyAt('03:00')
    ->withoutOverlapping(60)
    ->onOneServer()
    ->runInBackground();

Artisan::command('notifications:duels-expiring', function () {
    $count = NotificationScheduler::dispatchDuelExpiring();
    $this->info("Sendte {$count} duel-expiring notifikationer.");
})->purpose('Notificer dyst-deltagere naar dysten udloeber inden for 2 timer');

Artisan::command('notifications:event-reminders', function () {
    $count = NotificationScheduler::dispatchEventReminders();
    $this->info("Sendte {$count} event-reminder notifikationer.");
})->purpose('Send event-reminders 24t og 2t foer en begivenhed');

Artisan::command('notifications:rsvp-reminders', function () {
    $count = NotificationScheduler::dispatchRsvpReminders();
    $this->info("Sendte {$count} rsvp-reminder notifikationer.");
})->purpose('Mind inviterede uden RSVP-svar');

Artisan::command('notifications:good-deed-reminders', function () {
    $count = NotificationScheduler::dispatchGoodDeedReminders();
    $this->info("Sendte {$count} good-deed-reminder notifikationer.");
})->purpose('Mind medlemmer om ugens gode gerning hvis ikke claimet');

Artisan::command('notifications:streak-reminders', function () {
    $count = NotificationScheduler::dispatchStreakReminders();
    $this->info("Sendte {$count} streak-reminder notifikationer.");
})->purpose('Mind medlemmer om at bevare deres ugentlige streak');

Schedule::command('notifications:duels-expiring')
    ->hourly()
    ->withoutOverlapping(20)
    ->onOneServer();

Schedule::command('notifications:event-reminders')
    ->hourly()
    ->withoutOverlapping(20)
    ->onOneServer();

Schedule::command('notifications:rsvp-reminders')
    ->dailyAt('17:00')
    ->withoutOverlapping(60)
    ->onOneServer();

Schedule::command('notifications:good-deed-reminders')
    ->weeklyOn(5, '17:00')
    ->withoutOverlapping(60)
    ->onOneServer();

Schedule::command('notifications:streak-reminders')
    ->dailyAt('19:00')
    ->withoutOverlapping(60)
    ->onOneServer();
