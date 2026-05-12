@extends('layouts.studos')

@section('title', 'FAQ · Studos')

@section('content')
  <section class="page faq-page">
    <div class="faq-hero">
      <h1>Spørgsmål om Studos-appen</h1>
      <p>
        Alt du skal vide om appen samlet ét sted.
      </p>
    </div>

    <div class="faq-sections">
      <div class="faq-section">
        <h2>Kom i gang</h2>
        <div class="faq-list">
          <details class="faq-item" open>
            <summary>Hvad er Studos?</summary>
            <p>
              Studos er en privat klassehub til studenteråret. Klassen får et samlet
              sted til kalender, chat, Caps, Dyst, klassedyst, gallerier, aktiviteter
              og praktiske oplysninger, så planer og minder ikke ligger spredt i
              forskellige gruppechats.
            </p>
          </details>

        <details class="faq-item">
          <summary>Er appen offentligt tilgængelig endnu?</summary>
          <p>
            Studos er stadig under udvikling og klargøres til rigtige iOS- og
            Android-apps. Websiden er kun informationsside med FAQ, vilkår,
            privatliv og support, mens download-knapperne på forsiden kun er
            design-preview, indtil appen er klar i App Store og Google Play.
          </p>
        </details>

        <details class="faq-item">
          <summary>Foregår oprettelse på web eller i appen?</summary>
          <p>
            Det foregår i appen. Der kommer ikke klasseoprettelse, CMS-login eller
            andre klassefunktioner på web. Når Studos åbner for klasser, vil
            oprettelse, invitationer, klasseprofil, medlemmer, events og
            indstillinger blive håndteret direkte i appen.
          </p>
        </details>

        <details class="faq-item">
          <summary>Hvad bruges websiden så til?</summary>
          <p>
            Websiden bruges til at forklare Studos, vise appens funktioner og
            samle praktiske sider som FAQ, brugervilkår, privatlivspolitik,
            cookiepolitik og slet-konto-information. Selve produktet bor i appen.
          </p>
        </details>

        <details class="faq-item">
          <summary>Hvordan kommer elever ind i klassen?</summary>
          <p>
            Elever bliver inviteret i appen via klassens adgangsflow. Klasseejeren
            kan styre, om nye medlemmer kan komme direkte ind, skal godkendes
            først, eller om klassen midlertidigt er lukket for nye anmodninger.
          </p>
        </details>

        <details class="faq-item">
          <summary>Kan den samme email bruges i flere klasser?</summary>
          <p>
            Nej. En medlems-email kan kun knyttes til én klasse ad gangen. Det gør
            login, adgang, notifikationer og privat klasseindhold mere tydeligt
            for både elever og klasseadmin.
          </p>
        </details>
      </div>
    </div>

    <div class="faq-section">
      <h2>Funktioner i appen</h2>
      <div class="faq-list">
        <details class="faq-item">
          <summary>Hvad finder man i appens navigation?</summary>
          <p>
            Appens faste footer samler de vigtigste områder: Kalender, Chat,
            Overblik, Dyst og Galleri. Sidebaren giver adgang til Din klasse,
            Optjen Caps, Leaderboard, Arcade Hub, Aktiviteter, Mit crew,
            Nødkontakter, Indstillinger og, for klasseadmin, Admin-funktioner.
          </p>
        </details>

        <details class="faq-item">
          <summary>Hvad viser Overblik?</summary>
          <p>
            Overblik er elevens startside i appen. Den viser profil, QR- og
            Studos-kode, klasseinfo, hueklip, dagens og kommende events, de
            nyeste relevante aktiviteter, Caps-balance og en genvej til aktuelle
            dyster.
          </p>
        </details>

        <details class="faq-item">
          <summary>Hvordan fungerer Kalender?</summary>
          <p>
            Kalenderen samler klassens events med dato, tid, sted, coverbillede
            og deltagelse. Elever kan svare på RSVP, se hvem der kommer, og åbne
            events direkte fra Overblik. Appen understøtter også eventinvitationer,
            ændringer og påmindelser via push-notifikationer.
          </p>
        </details>

        <details class="faq-item">
          <summary>Hvordan fungerer Chat?</summary>
          <p>
            Chatten understøtter direkte beskeder, gruppechats, gruppebilleder,
            ulæste beskeder og reaktioner på beskeder. Gruppeejere kan ændre navn,
            tilføje medlemmer og bruge gruppeheaderen som samlingspunkt, mens
            automatisk opdatering holder samtalerne levende, også hvis forbindelsen
            kortvarigt driller.
          </p>
        </details>

        <details class="faq-item">
          <summary>Hvad er Mit crew?</summary>
          <p>
            Mit crew er elevens personlige netværk i klassen. Her kan man holde
            styr på de klassekammerater, man har connectet med, og skjule eller
            blokere personer fra relevante visninger, hvis der er behov for det.
          </p>
        </details>

        <details class="faq-item">
          <summary>Hvad er Caps?</summary>
          <p>
            Caps er Studos' interne sociale point. De bruges til leaderboard,
            Dyst, Challenges, ugens gode gerning og små klasseaktiviteter. Caps
            har ingen pengeværdi, kan ikke købes, sælges, veksles eller bruges
            som præmie uden for Studos.
          </p>
        </details>

        <details class="faq-item">
          <summary>Hvordan optjener man Caps?</summary>
          <p>
            Caps kan optjenes gennem aktivitet i appen. Den aktuelle version har
            weekly streak ved app-åbning, Ugens gode gerning, QR-check-in og Dyst
            som centrale indgange. Ugens gode gerning giver Caps én gang pr. uge,
            og en 7-dages streak giver en ekstra belønning.
          </p>
        </details>

        <details class="faq-item">
          <summary>Hvordan fungerer Dyst og Challenges?</summary>
          <p>
            Dyst har to typer. Mod hinanden er en 1:1-konkurrence, hvor begge
            parter låser Caps midlertidigt i appen, og vinderen får puljen, når
            resultatet er godkendt. Challenge er en envejs-udfordring, hvor
            opretteren låser en belønning, og modtageren får den, hvis opretteren
            godkender gennemførslen. Dyster kan have deadline, dommerflow, arkiv og
            notifikationer om invitationer, svar og handlinger.
          </p>
        </details>

        <details class="faq-item">
          <summary>Hvad er Klassedyst?</summary>
          <p>
            Klassedyst sammenligner klasser på en mere fair måde ved at rangere
            efter Caps pr. aktiv elev. Ranglisten viser placering, total Caps,
            Caps pr. elev og markerer brugerens egen klasse, så både små og store
            klasser kan være med.
          </p>
        </details>

        <details class="faq-item">
          <summary>Hvordan fungerer Galleri og Walls?</summary>
          <p>
            Galleri samler klassens billeder i albums. Albums kan være fælles
            eller private for bestemte medlemmer, og appen understøtter
            flerbillede-upload, 3-kolonne grid, billedviewer med swipe,
            multi-select, gem på telefon, sletning og rapportering af billeder.
          </p>
        </details>

        <details class="faq-item">
          <summary>Hvad er Aktiviteter?</summary>
          <p>
            Aktiviteter er klassens feed for relevante hændelser, fx nye events,
            albums, uploads, fødselsdage, nye klassemedlemmer og afsluttede
            dyster. Feedet er ikke offentligt og filtrerer indhold, så elever kun
            ser events, albums og uploads, de faktisk har adgang til.
          </p>
        </details>
      </div>
    </div>

    <div class="faq-section">
      <h2>Notifikationer</h2>
      <div class="faq-list">
        <details class="faq-item">
          <summary>Hvilke push-notifikationer kan Studos sende?</summary>
          <p>
            Appen kan sende native push-notifikationer på iOS og Android om nye
            chatbeskeder, gruppechat-invitationer, Dyst, eventinvitationer,
            eventændringer, event- og RSVP-påmindelser, nye gallerier og billeder,
            klassebeskeder, connections, Ugens gode gerning og weekly streak.
          </p>
        </details>

        <details class="faq-item">
          <summary>Kan man selv styre notifikationer?</summary>
          <p>
            Ja. Under Indstillinger kan elever slå push til og fra og vælge, hvilke
            kategorier de vil have notifikationer om. Appen respekterer både
            telefonens systemtilladelse og Studos' egne kategoriindstillinger.
          </p>
        </details>

        <details class="faq-item">
          <summary>Sender Studos påmindelser automatisk?</summary>
          <p>
            Ja, når notifikationer er slået til. Studos kan minde om kommende
            events, manglende RSVP, Dyst-deadlines, Ugens gode gerning og weekly
            streak. Påmindelser samles, så den samme relevante besked ikke sendes
            igen og igen.
          </p>
        </details>
      </div>
    </div>

    <div class="faq-section">
      <h2>Tryghed, data og support</h2>
      <div class="faq-list">
        <details class="faq-item">
          <summary>Hvem kan administrere klassen?</summary>
          <p>
            Klasseejeren kan administrere klasseprofil, medlemmer, join-policy,
            dimissionsdato, roller og klasse-notifikationer direkte i appen.
            Moderatorer kan behandle rapporteringer. Almindelige elever ser ikke
            Admin-sektionen.
          </p>
        </details>

        <details class="faq-item">
          <summary>Hvordan fungerer rapportering og moderation?</summary>
          <p>
            Elever kan rapportere relevant indhold, fx chatbeskeder og billeder.
            Klasseadmin kan se rapporter i appen, afvise dem eller give en strike.
            Ved tre aktive strikes udelukkes brugeren fra klassen, og
            strike-advarsler vises tydeligt næste gang brugeren åbner appen.
          </p>
        </details>

        <details class="faq-item">
          <summary>Hvem kan se private events, albums og aktivitet?</summary>
          <p>
            Studos filtrerer adgang pr. bruger. Private events og albums vises kun
            for de medlemmer, der er inviteret eller har adgang, og aktivitetslog
            samt Overblik viser kun de hændelser, brugeren må se.
          </p>
        </details>

        <details class="faq-item">
          <summary>Hvad bruges Nødkontakter til?</summary>
          <p>
            Nødkontakter er en praktisk genvej i appen, så en elev kan gemme en
            kontaktperson, der er hurtig at finde, når der er brug for hjælp under
            studenteraktiviteter. Feltet er valgfrit.
          </p>
        </details>

        <details class="faq-item">
          <summary>Kan man slette sin konto?</summary>
          <p>
            Ja. Kontosletning findes i appen og er beskrevet på
            <a href="{{ route('legal.delete-account') }}">slet-konto-siden</a>.
            Flowet advarer tydeligt, fordi sletning er irreversibel, og relevante
            personoplysninger anonymiseres eller fjernes efter Studos'
            slettepolitik.
          </p>
        </details>

        <details class="faq-item">
          <summary>Hvor kan vi læse om data og vilkår?</summary>
          <p>
            Læs mere i
            <a href="{{ route('legal.privacy') }}">privatlivspolitikken</a>,
            <a href="{{ route('legal.terms') }}">brugervilkårene</a> og
            <a href="{{ route('legal.cookies') }}">cookiepolitikken</a>. Siderne
            beskriver blandt andet billeder, albummer, rapportering, fototilladelser,
            notifikationer, kontosletning og opbevaring.
          </p>
        </details>

        <details class="faq-item">
          <summary>Hvor kan vi få hjælp?</summary>
          <p>
            Skriv til <a href="mailto:chris.sorensen1702@gmail.com">chris.sorensen1702@gmail.com</a>, eller ring
            på <a href="tel:+4520631299">+45 20 63 12 99</a>.<br>
            PlateDigital EMV · CVR: 42456187 · Kærmindevej 12, 7441 Bording
          </p>
        </details>
      </div>
    </div>
    </div>
  </section>
@endsection
