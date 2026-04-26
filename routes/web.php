<?php

use App\Http\Controllers\StudosAuthController;
use App\Http\Controllers\StudosWebController;
use Illuminate\Support\Facades\Route;

Route::get('/', [StudosWebController::class, 'landing'])->name('home');
Route::get('/classes/{class}', [StudosWebController::class, 'redirectLegacyClass']);

Route::middleware('guest')->group(function (): void {
    Route::get('/login', [StudosAuthController::class, 'showLogin'])->name('login');
    Route::post('/login', [StudosAuthController::class, 'login'])->name('login.store');
    Route::get('/opret-klasse', [StudosWebController::class, 'createClass'])->name('classes.create');
    Route::post('/opret-klasse', [StudosWebController::class, 'storeClassWithUser'])->name('classes.create.store');
});

Route::middleware('auth')->group(function (): void {
    Route::post('/logout', [StudosAuthController::class, 'logout'])->name('logout');

    Route::get('/admin', [StudosWebController::class, 'admin'])->name('admin');
    Route::post('/admin/classes', [StudosWebController::class, 'storeClass'])->name('classes.store');
    Route::get('/admin/classes/{class}', [StudosWebController::class, 'show'])->name('classes.show');
    Route::patch('/admin/classes/{class}/settings', [StudosWebController::class, 'updateSettings'])->name('classes.settings.update');
    Route::post('/admin/classes/{class}/members', [StudosWebController::class, 'storeMember'])->name('classes.members.store');
    Route::patch('/admin/classes/{class}/members/{member}', [StudosWebController::class, 'updateMember'])->name('classes.members.update');
    Route::delete('/admin/classes/{class}/members/{member}', [StudosWebController::class, 'destroyMember'])->name('classes.members.destroy');
    Route::post('/admin/classes/{class}/content', [StudosWebController::class, 'storeContentBlock'])->name('classes.content.store');
    Route::patch('/admin/classes/{class}/content/{block}', [StudosWebController::class, 'updateContentBlock'])->name('classes.content.update');
    Route::delete('/admin/classes/{class}/content/{block}', [StudosWebController::class, 'destroyContentBlock'])->name('classes.content.destroy');
    Route::post('/admin/classes/{class}/events', [StudosWebController::class, 'storeEvent'])->name('classes.events.store');
    Route::patch('/admin/classes/{class}/events/{event}', [StudosWebController::class, 'updateEvent'])->name('classes.events.update');
    Route::delete('/admin/classes/{class}/events/{event}', [StudosWebController::class, 'destroyEvent'])->name('classes.events.destroy');
});

Route::get('/index.html', function () {
    return redirect()->to(config('app.url'));
});
