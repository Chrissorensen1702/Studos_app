# Blueprint

## Platform

Studenter App er bygget som en platform, hvor hver klasse har sit eget private
rum. En klasse oprettes fra web/admin, og eleverne joiner via invite-kode eller
QR-kode.

## Roller

- Ejer: opretter klassen og kan administrere alt.
- Admin: kan redigere events, moderation og klasseindhold.
- Medlem: kan bruge appen og deltage i klassens indhold.

## Kerneflows

1. En bruger opretter en klasse via web/admin.
2. Brugeren angiver skole, klasse, aar og basale indstillinger.
3. Systemet laver en invite-kode og QR-kode.
4. Elever installerer appen, logger ind og joiner klassen.
5. Klassen bruger appen til events, feed, bla bog, billeder og nedtaellinger.

## MVP

- Auth og brugerprofiler.
- Opret/join klasse.
- Klasseforside i appen.
- Events og RSVP.
- Bla bog/profiler.
- Invite-kode/QR.
- Simpel admin-side.

