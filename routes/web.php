<?php

use App\Http\Controllers\StudosAuthController;
use App\Http\Controllers\StudosWebController;
use Illuminate\Support\Facades\Route;

Route::get('/', [StudosWebController::class, 'landing'])->name('home');
Route::get('/om-studos', [StudosWebController::class, 'about'])->name('about');
Route::get('/faq', [StudosWebController::class, 'faq'])->name('faq');
Route::get('/brugervilkaar', [StudosWebController::class, 'terms'])->name('legal.terms');
Route::get('/privatlivspolitik', [StudosWebController::class, 'privacy'])->name('legal.privacy');
Route::get('/cookiepolitik', [StudosWebController::class, 'cookies'])->name('legal.cookies');
Route::get('/slet-konto', [StudosWebController::class, 'deleteAccount'])->name('legal.delete-account');
Route::redirect('/pwa', '/');
Route::redirect('/pwa/{any}', '/')->where('any', '.*');

Route::redirect('/index.html', '/');

Route::post('/logout', [StudosAuthController::class, 'logout'])->name('logout');

Route::get('/login', [StudosWebController::class, 'redirectToHome'])->name('login');
Route::post('/login', [StudosWebController::class, 'redirectToHome']);
Route::match(['get', 'post'], '/opret-klasse', [StudosWebController::class, 'redirectToHome']);
Route::get('/admin', [StudosWebController::class, 'redirectToHome']);
Route::any('/admin/{any}', [StudosWebController::class, 'redirectToHome'])->where('any', '.*');
Route::get('/classes/{class}', [StudosWebController::class, 'redirectToHome']);
