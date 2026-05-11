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
        <span><strong>Version:</strong> 1.2</span>
        <span><strong>Senest opdateret:</strong> 11. maj 2026</span>
        <span><strong>Udbyder:</strong> PlateDigital EMV · CVR 42456187</span>
      </div>
    </header>

    <div class="legal-content">
      <div class="legal-callout">
        <strong>Kort fortalt:</strong> Studos er gratis, reklamefrit og uden tracking.
        Du skal være mindst 15 år for at oprette en konto. Du må ikke chikanere,
        true eller dele andres indhold uden samtykke. Del kun billeder, du har ret
        til at dele, og respekter hvis nogen beder om at få et billede fjernet. Vi
        handler hurtigt på rapporter og du kan til enhver tid blokere, klage eller
        slette din konto.
      </div>

      <article id="udbyder" class="legal-section">
        <h2>1. Udbyder og kontakt</h2>
        <p>
          Studos drives af <strong>PlateDigital EMV</strong>, CVR 42456187,
          Kærmindevej 12, 7441 Bording. Henvendelser om vilkårene,
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
          Studos er rettet mod elever på ungdomsuddannelser. Som forretningsregel
          skal du være mindst <strong>15 år</strong> for at oprette en konto. Når
          du er 15 år, kan du selv afgive samtykke til behandling af dine
          personoplysninger på Studos, jf. databeskyttelsesforordningens art. 8
          sammenholdt med dansk ret.
        </p>
        <p>
          Er du under 15 år, må du ikke oprette en konto. Hvis vi bliver
          opmærksomme på, at en konto er oprettet af en bruger under 15 år,
          sletter vi kontoen. Forældre eller værger, der ønsker at anmode om
          sletning på vegne af et barn, kan kontakte
          <a href="mailto:hej@studos.dk">hej@studos.dk</a>.
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
          <li>Uploade eller dele billeder af andre uden samtykke eller andet klart lovligt grundlag.</li>
          <li>Gemme, kopiere eller videredele andres billeder uden for Studos uden deres samtykke eller andet lovligt grundlag.</li>
          <li>Anvende automatiserede systemer (bots, scripts, crawlers) uden skriftlig tilladelse.</li>
          <li>Oprette dyster eller udfordringer, der involverer alkohol, stoffer, vold, færdsel, selvskade, ulovlige handlinger eller på anden vis kan skade dig selv eller andre.</li>
        </ul>
      </article>

      <article id="ugc" class="legal-section">
        <h2>6. Brugerindhold (UGC) og adfærdskodeks</h2>
        <p>
          Når du deler beskeder, billeder, begivenheder eller andet indhold på Studos,
          giver du os en ikke-eksklusiv, royaltyfri, verdensomspændende licens til at
          hoste, lagre, behandle, vise og overføre indholdet i det omfang, det er
          nødvendigt for at drive tjenesten — herunder visning til det publikum, du
          har valgt (din klasse, din connection eller dig selv), sikkerhedskopier,
          fejlfinding, moderation og overholdelse af lov. Licensen ophører i alt
          væsentligt når du sletter indholdet eller din konto, men vi kan beholde
          en kopi i moderations- og logsystemer i overensstemmelse med pkt. 8 og
          vores <a href="{{ route('legal.privacy') }}">privatlivspolitik</a>.
          Du beholder selv ophavsretten til dit indhold.
        </p>
        <p>
          Når du uploader billeder til et album, bekræfter du, at du har ret til at
          dele billedet med den valgte målgruppe, og at eventuelle genkendelige
          personer på billedet ikke med rimelighed kan forvente, at billedet holdes
          privat. Vær særligt varsom med billeder af børn og unge, billeder fra
          fester, private situationer, sårbare situationer eller billeder, der kan
          opfattes som ydmygende, seksuelle, krænkende eller udstillende.
        </p>
        <p>
          Albummer er lukkede for den valgte målgruppe i Studos. Hvis du kan gemme
          et billede på din telefon, må det kun bruges til privat og lovlig brug.
          Du må ikke offentliggøre eller videresende billeder uden for Studos uden
          samtykke eller andet lovligt grundlag. Album-ejere, uploadere og
          berettigede klasseansvarlige kan slette billeder, og Studos kan fjerne
          eller begrænse indhold efter rapport, indsigelse eller mistanke om
          misbrug.
        </p>
        <p>Indhold, der er forbudt på Studos, omfatter — men er ikke begrænset til:</p>
        <ul>
          <li>Hadefuldt, racistisk, sexistisk, homofobisk eller diskriminerende indhold.</li>
          <li>Mobning, trusler, chikane eller udhængning af enkeltpersoner.</li>
          <li>Seksuelt indhold, særligt indhold der involverer mindreårige.</li>
          <li>Intime, private, følsomme eller ydmygende billeder uden klart samtykke.</li>
          <li>Billeder eller videoer, der udstiller beruselse, nøgenhed, sygdom, skade, selvskade eller andre sårbare situationer.</li>
          <li>Vold, selvskade, opfordring til selvmord eller livsfarlige handlinger.</li>
          <li>Salg eller deling af ulovlige stoffer, våben eller andre regulerede produkter.</li>
          <li>Spam, phishing, svindel eller falske identiteter.</li>
          <li>Indhold, der krænker andres ophavsret, varemærker eller privatliv.</li>
        </ul>
      </article>

      <article id="krise" class="legal-section">
        <h2>7. Sikkerhed, krise og hjælpetjenester</h2>
        <p>
          Hvis du eller en, du kender, har det svært, opfordrer vi dig til at række
          ud — også uden for Studos. Du kan kontakte:
        </p>
        <ul>
          <li><strong>Livslinien</strong> (alle aldre): <a href="tel:+4570201201">70 20 12 01</a></li>
          <li><strong>Børns Vilkår — BørneTelefonen</strong> (under 18): <a href="tel:116111">116 111</a></li>
          <li>Ved akut fare for liv eller helbred: ring <strong>112</strong></li>
        </ul>
        <p>
          Bliver vi opmærksomme på indhold, der tyder på umiddelbar fare for liv
          eller helbred, kan vi kontakte myndighederne i overensstemmelse med
          gældende ret.
        </p>
      </article>

      <article id="moderation" class="legal-section">
        <h2>8. Moderation, rapportering og din ret til at klage</h2>
        <p>
          Studos giver dig værktøjer til at beskytte dig selv og din klasse:
        </p>
        <ul>
          <li><strong>Blokering:</strong> Du kan blokere andre brugere fra app-indstillingerne. Blokerede brugere kan ikke kontakte dig eller se din aktivitet.</li>
          <li><strong>Rapportering (notice):</strong> Du kan rapportere chats, beskeder, begivenheder, albummer, enkeltbilleder, gallerier og brugere direkte i appen. Indberetningen modtager en kvittering, jf. forordning (EU) 2022/2065 (DSA) art. 16.</li>
          <li><strong>Liste over blokeringer:</strong> Du kan til enhver tid se og fjerne dine blokeringer i indstillingerne.</li>
        </ul>
        <p>
          Vi gennemgår alle rapporter og handler så hurtigt som muligt. Hvis vi
          fjerner indhold, suspenderer eller lukker din konto, modtager du en
          begrundelse (statement of reasons), jf. DSA art. 17.
        </p>
        <p>
          Ved rapporter om billeder kan vi skjule, slette eller begrænse adgang til
          billedet, mens sagen vurderes. Gentagne eller alvorlige overtrædelser kan
          føre til midlertidig suspension eller permanent lukning af kontoen.
        </p>
        <p>
          <strong>Klage:</strong> Du kan klage over en modererings­beslutning ved
          at skrive til <a href="mailto:hej@studos.dk?subject=Klage%20over%20moderation">hej@studos.dk</a>
          inden for <strong>6 måneder</strong> efter beslutningen, jf. DSA art. 20.
          Vi behandler klager uden urimelig forsinkelse, upartisk og efter en
          gennemgang foretaget af et menneske — ikke en automatiseret proces alene.
        </p>
        <p>
          <strong>Udenretlig tvistbilæggelse:</strong> Du har endvidere ret til at
          indbringe tvister om moderation for et certificeret out-of-court
          dispute-organ, jf. DSA art. 21. Listen over certificerede organer
          offentliggøres af EU-Kommissionen og Erhvervsstyrelsen.
        </p>
      </article>

      <article id="nul-tolerance" class="legal-section">
        <h2>9. Nul tolerance for stødende indhold</h2>
        <div class="legal-callout">
          Studos har <strong>nul tolerance</strong> for objektivt stødende indhold og
          chikanerende adfærd, herunder krænkende billeder, ulovligt seksuelt
          indhold, billeder af mindreårige i seksuelle sammenhænge og ikke-samtykket
          intimt indhold. Brud på dette punkt fører til øjeblikkelig fjernelse af
          indhold og kan resultere i permanent lukning af kontoen. Du modtager en
          begrundelse og kan klage som beskrevet i pkt. 8.
        </div>
      </article>

      <article id="caps" class="legal-section">
        <h2>10. Caps, dyster og virtuelle elementer</h2>
        <p>
          Caps og andre virtuelle elementer i Studos har <strong>ingen pengeværdi</strong>,
          kan ikke veksles til kontanter eller varer, og kan ikke overdrages mellem
          konti uden for appens egne mekanismer. Caps udgør hverken e-penge,
          betalingsmidler eller en tilgodehavende fordring mod Studos. Vi
          forbeholder os ret til at justere, nulstille eller fjerne Caps-saldi,
          hvis vi opdager misbrug, snyd eller fejl.
        </p>
        <p>
          Dyster og udfordringer arrangeres af klassens medlemmer. Studos er ikke
          part i indbyrdes aftaler mellem brugere uden for appens mekanismer, og
          er ikke ansvarlig for udfald, præmier eller skader, der følger af
          brugeroprettede dyster.
        </p>
      </article>

      <article id="mindrearige" class="legal-section">
        <h2>11. Beskyttelse af mindreårige og fravær af reklamer</h2>
        <p>
          Studos henvender sig primært til mindreårige (15–19 år) og er omfattet af
          DSA art. 28 om særlig beskyttelse af mindreårige. Vi har implementeret
          følgende foranstaltninger:
        </p>
        <ul>
          <li><strong>Ingen reklamer.</strong> Studos viser ingen kommercielle reklamer overhovedet.</li>
          <li><strong>Ingen profilering.</strong> Vi profilerer ikke brugere på baggrund af adfærd, interesser eller personoplysninger, og vi anvender ingen adfærdsbaseret målretning, jf. DSA art. 28, stk. 2.</li>
          <li><strong>Ingen tracking-SDK'er.</strong> Vi anvender hverken Apple App Tracking Transparency, Google UMP, Facebook Pixel, Google Analytics eller lignende sporings-værktøjer.</li>
          <li><strong>Lukket community.</strong> Indhold deles kun inden for klassen, albummer, gruppechats, direktechats eller med dine connections — aldrig offentligt indekseret.</li>
          <li><strong>Standard-private profiler.</strong> Profilers synlighed er som udgangspunkt begrænset til klassen.</li>
          <li><strong>Aktiv moderation</strong> og bruger-værktøjer til blokering og rapportering, jf. pkt. 8.</li>
        </ul>
      </article>

      <article id="ip" class="legal-section">
        <h2>12. Immaterielle rettigheder</h2>
        <p>
          Studos-navnet, logo, design, kildekode og indhold tilhører PlateDigital EMV og er
          beskyttet af ophavsretslovgivning. Du må ikke kopiere, videredistribuere
          eller skabe afledte værker uden skriftlig tilladelse.
        </p>
      </article>

      <article id="ophavsret" class="legal-section">
        <h2>13. Ophavsretsmeddelelser (notice-and-takedown)</h2>
        <p>
          Hvis du mener, at indhold på Studos krænker din ophavsret eller andre
          rettigheder, kan du indsende en begrundet meddelelse efter
          e-handelslovens § 16 og DSA art. 16 til
          <a href="mailto:hej@studos.dk?subject=Ophavsretskr%C3%A6nkelse">hej@studos.dk</a>.
          Meddelelsen bør indeholde:
        </p>
        <ol>
          <li>En tilstrækkelig begrundet forklaring på, hvorfor indholdet er ulovligt.</li>
          <li>Præcis placering (URL, skærmbillede eller anden klar identifikation).</li>
          <li>Dine kontaktoplysninger (navn, adresse, e-mail), medmindre meddelelsen vedrører seksualforbrydelser mv. mod børn, hvor anonymitet kan accepteres.</li>
          <li>En erklæring om, at du i god tro mener, at de oplysninger, du har givet, er korrekte og fuldstændige.</li>
        </ol>
        <p>
          Vi bekræfter modtagelse, gennemgår meddelelsen omhyggeligt og giver
          besked om vores beslutning samt klagemuligheder, jf. DSA art. 16, stk.
          5 og art. 17.
        </p>
      </article>

      <article id="tredjeparter" class="legal-section">
        <h2>14. Tredjepartstjenester</h2>
        <p>
          Studos bruger tredjepartstjenester til hosting og push-notifikationer.
          Disse er beskrevet i vores
          <a href="{{ route('legal.privacy') }}">privatlivspolitik</a>. Apple App
          Store og Google Play optræder som <em>selvstændige dataansvarlige</em>
          for distribution af appen og er ikke vores databehandlere. Vi er ikke
          ansvarlige for tredjeparters egne vilkår og praksisser, men vælger
          leverandører med GDPR-compliance og forsvarlig databehandling.
        </p>
      </article>

      <article id="ansvar" class="legal-section">
        <h2>15. Ansvar og garantier</h2>
        <p>
          Studos leveres “som den er”. Vi tilstræber høj oppetid og fejlfri funktion,
          men kan ikke garantere det. Vi er ikke ansvarlige for indirekte tab,
          tabt fortjeneste eller for handlinger udført af andre brugere.
        </p>
        <p>
          Vores ansvar er begrænset i det omfang, ufravigelig dansk lovgivning
          tillader det. Intet i disse vilkår begrænser vores ansvar for forsætlige
          eller groft uagtsomme handlinger, personskade eller forhold, som efter
          ufravigelig forbruger- eller databeskyttelseslovgivning ikke kan
          begrænses.
        </p>
      </article>

      <article id="opsigelse" class="legal-section">
        <h2>16. Opsigelse og kontosletning</h2>
        <p>
          Du kan til enhver tid slette din konto i appens indstillinger eller via
          <a href="{{ route('legal.delete-account') }}">studos.dk/slet-konto</a>.
          Sletning deaktiverer din profil og pseudonymiserer dine personoplysninger
          straks. Visse oplysninger kan opbevares i en kortere periode af
          lovgivningsmæssige eller sikkerhedsmæssige grunde — se vores
          <a href="{{ route('legal.privacy') }}">privatlivspolitik</a>.
        </p>
        <p>
          Billeder, du har uploadet til fælles albummer, slettes ikke nødvendigvis
          automatisk sammen med kontoen, hvis de indgår i klassens fælles historik.
          Du kan slette egne billeder før kontosletning eller kontakte os, hvis du
          ønsker konkrete billeder fjernet. Efter kontosletning pseudonymiseres din
          uploader-identitet.
        </p>
        <p>
          <strong>Klasse-ejere:</strong> Hvis du er den eneste aktive ejer (owner)
          af en klasse, skal du først overdrage ejerskabet til en anden i klassen,
          før du kan slette din konto. Det sikrer, at klassen ikke står uden
          administrator. Skriv til <a href="mailto:hej@studos.dk">hej@studos.dk</a>
          hvis du har brug for hjælp.
        </p>
        <p>
          Vi kan suspendere eller lukke din konto med øjeblikkelig virkning ved brud på
          disse vilkår, særligt ved overtrædelse af pkt. 6 og 9. Du modtager
          begrundelse og klagemulighed efter pkt. 8.
        </p>
      </article>

      <article id="aendringer" class="legal-section">
        <h2>17. Ændringer i vilkårene</h2>
        <p>
          Vi kan opdatere disse vilkår. Væsentlige ændringer varsles i appen mindst
          <strong>14 dage</strong>, før de træder i kraft. Fortsat brug efter ikrafttræden
          udgør accept af de nye vilkår. Den til enhver tid gældende version er tilgængelig
          på denne side med tydelig angivelse af versionsnummer og opdateringsdato.
        </p>
      </article>

      <article id="lov" class="legal-section">
        <h2>18. Lovvalg og værneting</h2>
        <p>
          Disse vilkår er underlagt dansk ret. Tvister, der ikke kan løses ved dialog
          eller via klagemekanismerne i pkt. 8, afgøres ved de almindelige danske
          domstole. Som forbruger har du altid ret til at anlægge sag ved retten
          i den retskreds, hvor du bor, jf. retsplejelovens § 244 og forordning
          (EU) nr. 1215/2012 art. 17–19.
        </p>
        <p>
          Du har desuden mulighed for at klage til Datatilsynet om vores
          behandling af personoplysninger og til Forbrugerombudsmanden om
          markedsføringsforhold.
        </p>
      </article>

      <article id="kontakt" class="legal-section">
        <h2>19. Kontakt</h2>
        <p>
          <strong>PlateDigital EMV</strong><br>
          CVR: 42456187<br>
          Kærmindevej 12, 7441 Bording<br>
          E-mail: <a href="mailto:hej@studos.dk">hej@studos.dk</a><br>
          Support: <a href="mailto:hej@studos.dk">hej@studos.dk</a><br>
          Telefon: <a href="tel:+4520631299">+45 20 63 12 99</a>
        </p>
      </article>
    </div>
  </section>
@endsection
