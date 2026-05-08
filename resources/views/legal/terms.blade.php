@extends('layouts.studos')

@section('title', 'Brugervilkår · Studos')

@section('content')
  <section class="page legal-page">
    <header class="legal-hero">
      <p class="eyebrow">Brugervilkår</p>
      <h1>Vilkår for brug af Studos</h1>
      <p>
        Studos er en privat klassehub til studenteråret. Disse vilkår beskriver
        de regler, du accepterer ved at oprette og bruge en Studos-konto i mobilappen
        eller på studos.dk. Læs dem grundigt — de gælder, så længe du har en konto.
      </p>
      <div class="legal-meta">
        <span><strong>Version:</strong> 1.0</span>
        <span><strong>Senest opdateret:</strong> 8. maj 2026</span>
        <span><strong>Udbyder:</strong> PlateDigital</span>
      </div>
    </header>

    <div class="legal-content">
      <article id="udbyder" class="legal-section">
        <h2>1. Udbyder og kontakt</h2>
        <p>
          Studos drives af <strong>PlateDigital</strong>. Henvendelser om vilkårene,
          support og rapportering af indhold sendes til
          <a href="mailto:hej@studos.dk">hej@studos.dk</a>
          eller på telefon <a href="tel:+4520631299">+45 20 63 12 99</a>.
        </p>
      </article>

      <article id="accept" class="legal-section">
        <h2>2. Accept af vilkårene</h2>
        <p>
          Ved at oprette en Studos-konto, logge ind eller bruge appen accepterer du
          disse brugervilkår samt vores
          <a href="{{ route('legal.privacy') }}">privatlivspolitik</a> og
          <a href="{{ route('legal.cookies') }}">cookiepolitik</a>. Hvis du ikke
          accepterer vilkårene, må du ikke bruge tjenesten.
        </p>
        <p>
          Ved oprettelse markerer du aktivt, at du har læst og accepteret vilkårene
          og privatlivspolitikken. Samtykket logges sammen med tidspunkt og version.
        </p>
      </article>

      <article id="alder" class="legal-section">
        <h2>3. Alder og samtykke</h2>
        <p>
          Studos er rettet mod elever på ungdomsuddannelser. Du skal være mindst
          <strong>15 år</strong> for at oprette en konto uden forældresamtykke,
          jf. databeskyttelsesloven § 6 stk. 3.
        </p>
        <p>
          Er du under 15 år, skal en forælder eller værge give samtykke til, at du
          opretter en konto og deler personoplysninger med Studos. Skriv til
          <a href="mailto:hej@studos.dk">hej@studos.dk</a>, hvis du har brug for
          en samtykke-skabelon.
        </p>
      </article>

      <article id="konto" class="legal-section">
        <h2>4. Din konto</h2>
        <ul>
          <li>Du må kun oprette én konto pr. person og kun med dine egne oplysninger.</li>
          <li>Du er ansvarlig for at holde din adgangskode hemmelig og for al aktivitet på din konto.</li>
          <li>Mistænker du misbrug, skal du straks skifte adgangskode og kontakte support.</li>
          <li>Din profil er knyttet til en bestemt klasse og kan invitere/forbinde med andre via Studos-kode.</li>
        </ul>
      </article>

      <article id="brug" class="legal-section">
        <h2>5. Tilladt brug</h2>
        <p>Du må bruge Studos til at:</p>
        <ul>
          <li>Kommunikere med klassekammerater i chat og opslagstavler.</li>
          <li>Oprette og deltage i klassekalender, dyster, gallerier og udfordringer.</li>
          <li>Optjene og bruge Caps i de funktioner, der understøtter det.</li>
        </ul>
        <p>Du må <strong>ikke</strong>:</p>
        <ul>
          <li>Bruge tjenesten til ulovlige, krænkende eller chikanerende formål.</li>
          <li>Forsøge at omgå sikkerhedsforanstaltninger, rate limits eller adgangskontrol.</li>
          <li>Scrape, kopiere eller videredistribuere data, du ikke selv har skabt.</li>
          <li>Indsende indhold om andre uden deres samtykke (særligt billeder og kontaktoplysninger).</li>
          <li>Anvende automatiserede systemer (bots, scripts, crawlers) uden skriftlig tilladelse.</li>
        </ul>
      </article>

      <article id="ugc" class="legal-section">
        <h2>6. Brugerindhold (UGC) og adfærdskodeks</h2>
        <p>
          Når du deler beskeder, billeder, begivenheder eller andet indhold på Studos,
          giver du os en ikke-eksklusiv, royalty-fri licens til at vise indholdet i
          appen for det publikum, du har valgt (din klasse, din connection eller dig selv).
          Du beholder selv ophavsretten til dit indhold.
        </p>
        <p>Indhold, der er forbudt på Studos, omfatter — men er ikke begrænset til:</p>
        <ul>
          <li>Hadefuldt, racistisk, sexistisk, homofobisk eller diskriminerende indhold.</li>
          <li>Mobning, trusler, chikane eller udhængning af enkeltpersoner.</li>
          <li>Seksuelt indhold, særligt indhold der involverer mindreårige.</li>
          <li>Vold, selvskade, opfordring til selvmord eller livsfarlige handlinger.</li>
          <li>Salg eller deling af ulovlige stoffer, våben eller andre regulerede produkter.</li>
          <li>Spam, phishing, svindel eller falske identiteter.</li>
          <li>Indhold, der krænker andres ophavsret, varemærker eller privatliv.</li>
        </ul>
      </article>

      <article id="moderation" class="legal-section">
        <h2>7. Moderation, blokering og rapportering</h2>
        <p>
          Studos giver dig værktøjer til at beskytte dig selv og din klasse:
        </p>
        <ul>
          <li><strong>Blokering:</strong> Du kan blokere andre brugere fra app-indstillingerne. Blokerede brugere kan ikke kontakte dig eller se din aktivitet.</li>
          <li><strong>Rapportering:</strong> Du kan rapportere chats, beskeder, begivenheder, gallerier og brugere direkte i appen.</li>
          <li><strong>Liste over blokeringer:</strong> Du kan til enhver tid se og fjerne dine blokeringer i indstillingerne.</li>
        </ul>
        <p>
          Vi gennemgår alle rapporter og handler senest <strong>inden for 24 timer</strong>.
          Konsekvenserne kan være advarsel, fjernelse af indhold, suspension eller
          permanent lukning af konto. Alvorlige forhold anmeldes til relevante myndigheder.
        </p>
      </article>

      <article id="nul-tolerance" class="legal-section">
        <h2>8. Nul tolerance for stødende indhold</h2>
        <div class="legal-callout">
          Studos har <strong>nul tolerance</strong> for objektivt stødende indhold og
          chikanerende adfærd. Brud på dette punkt fører til øjeblikkelig fjernelse
          af indhold og kan resultere i permanent lukning af kontoen uden varsel.
        </div>
      </article>

      <article id="caps" class="legal-section">
        <h2>9. Caps, dyster og virtuelle elementer</h2>
        <p>
          Caps og andre virtuelle elementer i Studos har <strong>ingen pengeværdi</strong>,
          kan ikke veksles til kontanter og kan ikke overdrages mellem konti uden for
          appens egne mekanismer. Vi forbeholder os ret til at justere, nulstille eller
          fjerne Caps-saldi, hvis vi opdager misbrug, snyd eller fejl.
        </p>
        <p>
          Dyster og udfordringer arrangeres af klassens medlemmer. Studos er ikke part
          i indbyrdes aftaler mellem brugere uden for appens mekanismer.
        </p>
      </article>

      <article id="ip" class="legal-section">
        <h2>10. Immaterielle rettigheder</h2>
        <p>
          Studos-navnet, logo, design, kildekode og indhold tilhører PlateDigital og er
          beskyttet af ophavsretslovgivning. Du må ikke kopiere, videredistribuere
          eller skabe afledte værker uden skriftlig tilladelse.
        </p>
      </article>

      <article id="ophavsret" class="legal-section">
        <h2>11. Ophavsret og DMCA-rapportering</h2>
        <p>
          Hvis du mener, at indhold på Studos krænker din ophavsret, kan du indsende
          en anmodning om fjernelse til
          <a href="mailto:hej@studos.dk?subject=Ophavsretskr%C3%A6nkelse">hej@studos.dk</a>.
          Anmodningen skal indeholde:
        </p>
        <ol>
          <li>Identifikation af det værk, der hævdes krænket.</li>
          <li>Link eller præcis placering af det krænkende indhold på Studos.</li>
          <li>Dine kontaktoplysninger (navn, adresse, e-mail).</li>
          <li>En erklæring om, at du i god tro mener, brugen ikke er autoriseret.</li>
          <li>En erklæring om, at oplysningerne er korrekte, og at du er rettighedshaver eller bemyndiget.</li>
          <li>Din underskrift (fysisk eller elektronisk).</li>
        </ol>
      </article>

      <article id="tredjeparter" class="legal-section">
        <h2>12. Tredjepartstjenester</h2>
        <p>
          Studos bruger tredjepartstjenester til hosting, push-notifikationer og
          fejlovervågning. Disse er beskrevet i vores
          <a href="{{ route('legal.privacy') }}">privatlivspolitik</a>. Vi er ikke
          ansvarlige for tredjeparters egne vilkår og praksisser, men vælger leverandører
          med GDPR-compliance og forsvarlig databehandling.
        </p>
      </article>

      <article id="ansvar" class="legal-section">
        <h2>13. Ansvar og garantier</h2>
        <p>
          Studos leveres “som den er”. Vi tilstræber høj oppetid og fejlfri funktion,
          men kan ikke garantere det. Vi er ikke ansvarlige for indirekte tab,
          tabt fortjeneste, tabte data ud over hvad der er pålagt ved lov, eller
          for handlinger udført af andre brugere.
        </p>
        <p>
          Da Studos pt. er gratis, er vores samlede ansvar over for dig begrænset til
          det største af DKK 500 eller hvad der måtte være pålagt ved ufravigelig lov.
        </p>
      </article>

      <article id="opsigelse" class="legal-section">
        <h2>14. Opsigelse og kontosletning</h2>
        <p>
          Du kan til enhver tid slette din konto i appens indstillinger eller via
          <a href="{{ route('legal.delete-account') }}">studos.dk/slet-konto</a>.
          Sletning anonymiserer dine personoplysninger og deaktiverer din profil.
          Visse oplysninger kan opbevares i en kortere periode af lovgivningsmæssige
          eller sikkerhedsmæssige grunde — se vores
          <a href="{{ route('legal.privacy') }}">privatlivspolitik</a>.
        </p>
        <p>
          Vi kan suspendere eller lukke din konto med øjeblikkelig virkning ved brud på
          disse vilkår, særligt ved overtrædelse af pkt. 6 og 8.
        </p>
      </article>

      <article id="aendringer" class="legal-section">
        <h2>15. Ændringer i vilkårene</h2>
        <p>
          Vi kan opdatere disse vilkår. Væsentlige ændringer varsles i appen mindst
          <strong>14 dage</strong>, før de træder i kraft. Fortsat brug efter ikrafttræden
          udgør accept af de nye vilkår. Den til enhver tid gældende version er tilgængelig
          på denne side med tydelig angivelse af versionsnummer og opdateringsdato.
        </p>
      </article>

      <article id="lov" class="legal-section">
        <h2>16. Lovvalg og værneting</h2>
        <p>
          Disse vilkår er underlagt dansk ret. Tvister, der ikke kan løses ved dialog,
          afgøres ved de almindelige danske domstole med Retten i Aarhus som første instans.
        </p>
      </article>

      <article id="kontakt" class="legal-section">
        <h2>17. Kontakt</h2>
        <p>
          <strong>PlateDigital</strong><br>
          E-mail: <a href="mailto:hej@studos.dk">hej@studos.dk</a><br>
          Support: <a href="mailto:support@studos.dk">support@studos.dk</a><br>
          Telefon: <a href="tel:+4520631299">+45 20 63 12 99</a>
        </p>
      </article>
    </div>
  </section>
@endsection
