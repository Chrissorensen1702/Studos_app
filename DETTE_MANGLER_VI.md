# Dette mangler vi

Arbejdsnote til ting vi ikke maa glemme, mens Studos bliver bygget videre.

## Notifikationer

- Naar push-notifikationer bliver sat paa, skal `Dagens stemning` have en
  daglig reminder.
- Reminderens formaal: faa brugeren ind og opdatere `Hvordan er stemningen?`
  paa Overblik.
- Den skal helst ikke foeles som spam:
  - Send kun hvis brugeren ikke allerede har opdateret stemningen i dag.
  - Giv brugeren mulighed for at slaa reminder fra eller justere tidspunkt.
  - Test evt. et tidspunkt efter skole, fx 15:00-17:00.
- Naar stemning bliver gemt i backend, skal vi gemme `mood`, `updated_at` og
  dato, saa appen kan vide om dagens check-in allerede er lavet.
