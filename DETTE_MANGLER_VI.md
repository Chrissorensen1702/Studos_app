# Dette mangler vi

Arbejdsnote til ting vi ikke maa glemme, mens Studos bliver bygget videre.

## Notifikationer

- Platformen virker nu paa iOS og Android via Expo Push Service.
- Verificeret: iOS test-push og chat-push mod Cloud API.
- Backend-suiten er udvidet til 17 kategorier: chat, gruppechat-invite, Dyst,
  event-invitationer/aendringer/reminders, RSVP-reminders, galleri,
  connections, ugens gode gerning og weekly streak.
- Naeste prioritet: preview/internal builds til iOS og Android og smoke-test
  paa fysiske enheder.
- Husk at verificere Laravel Scheduler i Cloud, saa reminder-pushes faktisk
  koerer.
- Senere: klasse-announcements, Caps-optjent digest og admin/moderation-pushes.
