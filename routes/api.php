<?php

use App\Http\Controllers\StudosController;
use App\Http\Controllers\ChatController;
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
Route::get('/session/me', [StudosController::class, 'sessionMe']);
Route::post('/notifications/push-token', [StudosController::class, 'registerPushToken'])->middleware('throttle:20,1');
Route::post('/notifications/test', [StudosController::class, 'sendTestNotification'])->middleware('throttle:6,1');
Route::post('/profile/photo', [StudosController::class, 'updateProfilePhoto'])->middleware('throttle:12,1');
Route::post('/classes/{class}/members/{member}/access', [StudosController::class, 'updateMemberAccess']);
Route::post('/events', [StudosController::class, 'storeEvent'])->middleware('throttle:12,1');
Route::post('/events/{event}/rsvp', [StudosController::class, 'respondToEvent'])->middleware('throttle:40,1');

Route::get('/chat/conversations', [ChatController::class, 'conversations']);
Route::post('/chat/realtime/auth', [ChatController::class, 'authorizeRealtimeChannel']);
Route::post('/chat/conversations/direct', [ChatController::class, 'createDirectConversation'])->middleware('throttle:20,1');
Route::post('/chat/conversations/group', [ChatController::class, 'createGroupConversation'])->middleware('throttle:10,1');
Route::get('/chat/conversations/{conversation}/messages', [ChatController::class, 'messages']);
Route::post('/chat/conversations/{conversation}/messages', [ChatController::class, 'sendMessage'])->middleware('throttle:40,1');
Route::post('/chat/conversations/{conversation}/read', [ChatController::class, 'markRead']);
Route::post('/chat/conversations/{conversation}/mute', [ChatController::class, 'muteConversation']);
Route::post('/chat/conversations/{conversation}/report', [ChatController::class, 'reportConversation'])->middleware('throttle:10,1');
Route::post('/chat/conversations/{conversation}/block', [ChatController::class, 'blockConversationMember'])->middleware('throttle:10,1');
Route::post('/chat/conversations/{conversation}/hide', [ChatController::class, 'hideConversation']);
Route::post('/chat/conversations/{conversation}/leave', [ChatController::class, 'leaveConversation']);
Route::delete('/chat/conversations/{conversation}', [ChatController::class, 'deleteConversation']);
Route::post('/chat/messages/{message}/report', [ChatController::class, 'reportMessage'])->middleware('throttle:10,1');
Route::delete('/chat/messages/{message}', [ChatController::class, 'deleteMessage']);
