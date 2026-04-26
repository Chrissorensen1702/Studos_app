<?php

use App\Http\Controllers\StudosController;
use Illuminate\Support\Facades\Route;

Route::get('/health', [StudosController::class, 'health']);
Route::get('/roles', [StudosController::class, 'roles']);
Route::get('/schools', [StudosController::class, 'schools']);
Route::get('/classes', [StudosController::class, 'classes']);
Route::post('/classes', [StudosController::class, 'storeClass']);
Route::get('/classes/id/{classId}', [StudosController::class, 'classByPublicId']);
Route::get('/classes/invite/{code}', [StudosController::class, 'classByInvite']);
Route::post('/classes/join', [StudosController::class, 'joinClass']);
Route::get('/members/code/{code}', [StudosController::class, 'memberByPersonalCode']);
Route::get('/members/{member}/connections', [StudosController::class, 'connectionsForMember']);
Route::post('/connections/request', [StudosController::class, 'requestConnection']);
Route::post('/connections/{connection}/respond', [StudosController::class, 'respondToConnection']);
Route::post('/session/login', [StudosController::class, 'loginWithPassword']);
Route::post('/session/request-code', [StudosController::class, 'requestLoginCode']);
Route::post('/session/verify-code', [StudosController::class, 'verifyLoginCode']);
Route::post('/classes/{class}/members/{member}/access', [StudosController::class, 'updateMemberAccess']);
