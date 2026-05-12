@extends('layouts.studos')

@section('title', 'Brugervilkår · Studos')

@section('content')
  <section class="page legal-page">
    <header class="legal-hero">
      <h1>Vilkår for brug af Studos</h1>
      <p>
        Studos er en lukket klasseapp til studenteråret. Vilkårene forklarer,
        hvad du må bruge appen til, hvordan vi håndterer indhold og rapporter,
        og hvad der kan ske, hvis reglerne bliver brudt.
      </p>
      <div class="legal-meta">
        <span><strong>Version:</strong> 1.3</span>
        <span><strong>Senest opdateret:</strong> 12. maj 2026</span>
        <span><strong>Udbyder:</strong> PlateDigital EMV · CVR 42456187</span>
      </div>
    </header>

    <div class="legal-content">
      <div class="legal-callout">
        <strong>Kort fortalt:</strong> Du skal være mindst 16 år. Appen er
        reklamefri og uden tracking. Du må ikke chikanere, true, udstille andre
        eller dele billeder uden ret til det. Rapporter kan føre til advarsel,
        strike, midlertidig begrænsning eller udelukkelse fra klassen.
      </div>

      <article id="udbyder" class="legal-section">
        <h2>1. Udbyder og kontakt</h2>
        <p>
          Studos drives af <strong>PlateDigital EMV</strong>, CVR 42456187,
          Kærmindevej 12, 7441 Bording. Spørgsmål om vilkår, support,
          rapportering eller klager sendes til
          <a href="mailto:chris.sorensen1702@gmail.com">chris.sorensen1702@gmail.com</a>
          eller på telefon <a href="tel:+4520631299">+45 20 63 12 99</a>.
        </p>
      </article>

      <article id="accept" class="legal-section">
        <h2>2. Accept</h2>
        <p>
          Når du opretter en konto, logger ind eller bruger Studos, accepterer
          du disse brugervilkår, vores
          <a href="{{ route('legal.privacy') }}">privatlivspolitik</a> og vores
          <a href="{{ route('legal.cookies') }}">cookiepolitik</a>. Hvis du ikke
          accepterer dem, må du ikke bruge appen.
        </p>
        <p>
          Ved oprettelse markerer du aktivt, at du har læst og accepteret
          vilkårene og privatlivspolitikken. Vi gemmer tidspunkt og version, så
          vi kan dokumentere, hvad du har accepteret.
        </p>
      </article>

      <article id="alder" class="legal-section">
        <h2>3. Alder</h2>
        <p>
          Du skal være mindst <strong>16 år</strong> for at oprette en Studos-konto.
          Appen afviser oprettelse, hvis den fødselsdato, du angiver, viser at du
          er under 16 år.
        </p>
        <p>
          Hvis vi bliver opmærksomme på, at en konto er oprettet af en bruger
          under 16 år, kan vi lukke kontoen og slette eller pseudonymisere
          oplysningerne. Forældre eller værger kan kontakte os på
          <a href="mailto:chris.sorensen1702@gmail.com">chris.sorensen1702@gmail.com</a>.
        </p>
      </article>

      <article id="konto" class="legal-section">
        <h2>4. Din konto</h2>
        <ul>
          <li>Du må kun oprette konto med dine egne oplysninger.</li>
          <li>Du må ikke låne din konto ud eller bruge en andens konto.</li>
          <li>Du er ansvarlig for at holde din adgangskode hemmelig.</li>
          <li>Din konto er knyttet til en klasse, en skole og din rolle i klassen.</li>
          <li>Hvis du mistænker misbrug, skal du skifte adgangskode og kontakte os.</li>
        </ul>
      </article>

      <article id="funktioner" class="legal-section">
        <h2>5. Hvad Studos kan bruges til</h2>
        <p>Studos kan blandt andet bruges til:</p>
        <ul>
          <li>Klassechat, gruppechat og direkte beskeder.</li>
          <li>Emoji-reaktioner på beskeder fra andre.</li>
          <li>Kalender, events, RSVP, gallerier og albummer.</li>
          <li>Dyster, udfordringer, Caps og klasseaktiviteter.</li>
          <li>Nødkontakt, hvis du selv vælger at tilføje den.</li>
          <li>Blokering og rapportering af brugere eller indhold.</li>
        </ul>
      </article>

      <article id="forbudt" class="legal-section">
        <h2>6. Det må du ikke bruge appen til</h2>
        <p>Du må ikke bruge Studos til at:</p>
        <ul>
          <li>Chikanere, mobbe, true, udstille eller presse andre.</li>
          <li>Dele hadefuldt, diskriminerende, seksuelt, voldeligt eller ulovligt indhold.</li>
          <li>Dele intime, private, ydmygende eller følsomme billeder uden klart samtykke.</li>
          <li>Dele billeder eller oplysninger om andre uden ret til det.</li>
          <li>Udgive dig for at være en anden eller oprette falske profiler.</li>
          <li>Spam, phishing, svindel eller forsøg på at omgå sikkerheden.</li>
          <li>Bruge bots, scripts, scraping eller automatiseret adgang uden skriftlig tilladelse.</li>
          <li>Oprette dyster eller udfordringer, der involverer alkohol, stoffer, vold, færdsel, selvskade, ulovlige handlinger eller anden risiko for skade.</li>
          <li>Gemme, kopiere eller videredele andres indhold uden for Studos uden samtykke eller andet lovligt grundlag.</li>
        </ul>
      </article>

      <article id="indhold" class="legal-section">
        <h2>7. Dit indhold</h2>
        <p>
          Du beholder rettighederne til det indhold, du selv opretter i Studos.
          Du giver os kun den brugsret, der er nødvendig for at drive appen:
          at lagre, behandle, vise, sende, sikkerhedskopiere og moderere
          indholdet i den målgruppe, du har valgt.
        </p>
        <p>
          Brugsretten gælder så længe indholdet ligger i Studos, og i det omfang
          det er nødvendigt for sikkerhed, fejlfinding, dokumentation af rapporter,
          lovkrav eller klassens fælles historik. Når du sletter indhold eller
          konto, håndteres det som beskrevet i
          <a href="{{ route('legal.privacy') }}">privatlivspolitikken</a> og på
          <a href="{{ route('legal.delete-account') }}">slet konto-siden</a>.
        </p>
        <p>
          Upload kun billeder, du har ret til at dele. Hvis personer kan genkendes
          på billedet, skal du overveje, om de rimeligt kan forvente, at billedet
          deles i den valgte målgruppe. Vær særligt varsom med billeder fra fester,
          private situationer, sårbare situationer og billeder, der kan virke
          krænkende eller udstillende.
        </p>
      </article>

      <article id="moderation" class="legal-section">
        <h2>8. Rapportering, blokering og moderation</h2>
        <p>
          Studos har brugerindhold, og derfor har appen værktøjer til at rapportere
          indhold og brugere, blokere andre og få en moderation gennemgået.
        </p>
        <ul>
          <li><strong>Blokering:</strong> Du kan blokere brugere, så de ikke kan kontakte dig.</li>
          <li><strong>Rapportering:</strong> Du kan rapportere chats, beskeder, brugere, events, albummer og billeder direkte i appen.</li>
          <li><strong>Gennemgang:</strong> Klasseejere, moderatorer eller Studos kan gennemgå rapporter og vurdere, hvad der skal ske.</li>
          <li><strong>Handlinger:</strong> Indhold kan blive skjult, slettet eller begrænset. En bruger kan få advarsel, strike, midlertidig begrænsning eller blive udelukket fra klassen.</li>
        </ul>
        <p>
          Vi forsøger at handle hurtigt, især ved trusler, mobning, intime billeder,
          ulovligt indhold, indhold om mindreårige eller anden alvorlig risiko.
          Ved akut fare for liv eller helbred bør du altid kontakte 112.
        </p>
      </article>

      <article id="strikes" class="legal-section">
        <h2>9. Strikes og udelukkelse</h2>
        <p>
          Studos bruger et strike-system til gentagne eller alvorlige brud på reglerne.
          En strike gives normalt efter en konkret rapport og menneskelig vurdering.
          Den vises for den berørte bruger i appen med årsag og antal strikes.
        </p>
        <ul>
          <li>Ved <strong>1. og 2. strike</strong> får brugeren en tydelig advarsel i appen.</li>
          <li>Ved <strong>3. strike</strong> bliver brugeren automatisk udelukket fra klassen.</li>
          <li>En udelukket bruger kan ikke længere bruge klassens fællesskab i Studos.</li>
          <li>Alvorlige sager kan føre til udelukkelse eller fjernelse uden at afvente 3 strikes.</li>
          <li>En eneejer af en klasse kan ikke udelukkes automatisk, før klassen har en anden aktiv ejer.</li>
        </ul>
        <p>
          Du kan klage over en strike, en udelukkelse eller en anden modereringsbeslutning
          ved at skrive til
          <a href="mailto:chris.sorensen1702@gmail.com?subject=Klage%20over%20moderation">chris.sorensen1702@gmail.com</a>.
          Skriv hvilken beslutning klagen handler om, hvorfor du er uenig, og eventuel
          dokumentation. Klagen vurderes af et menneske.
        </p>
      </article>

      <article id="sikkerhed" class="legal-section">
        <h2>10. Sikkerhed og hjælpetjenester</h2>
        <p>
          Studos er ikke en nødtjeneste. Hvis du eller en anden er i akut fare, skal
          du ringe 112. Hvis du eller en, du kender, har det svært, kan du også kontakte:
        </p>
        <ul>
          <li><strong>Livslinien:</strong> <a href="tel:+4570201201">70 20 12 01</a></li>
          <li><strong>BørneTelefonen:</strong> <a href="tel:116111">116 111</a></li>
        </ul>
        <p>
          Bliver vi opmærksomme på indhold, der tyder på nærliggende fare for liv
          eller helbred, kan vi handle uden varsel og kontakte relevante myndigheder,
          hvis det er nødvendigt og lovligt.
        </p>
      </article>

      <article id="caps" class="legal-section">
        <h2>11. Caps og dyster</h2>
        <p>
          Caps og andre virtuelle elementer i Studos har ingen pengeværdi. De kan ikke
          veksles til kontanter, varer eller ydelser og er ikke et betalingsmiddel.
          Vi kan justere eller fjerne Caps, hvis der er fejl, misbrug eller snyd.
        </p>
        <p>
          Dyster og udfordringer er brugeroprettede klasseaktiviteter. Studos er ikke
          ansvarlig for aftaler, præmier eller handlinger uden for appens egne funktioner.
        </p>
      </article>

      <article id="mindreaarige" class="legal-section">
        <h2>12. Beskyttelse af unge brugere</h2>
        <p>
          Studos er bygget til ungdomsuddannelser og unge brugere. Derfor har appen
          ingen reklamer, ingen målrettet annoncering, ingen tracking til markedsføring
          og ingen offentligt indekserede profiler. Fællesskaberne er lukkede omkring
          klasser, gruppechats, direkte chats, albummer og connections.
        </p>
      </article>

      <article id="ophavsret" class="legal-section">
        <h2>13. Ophavsret og rettigheder</h2>
        <p>
          Hvis du mener, at indhold i Studos krænker dine rettigheder, kan du skrive
          til <a href="mailto:chris.sorensen1702@gmail.com?subject=Indhold%20der%20skal%20vurderes">chris.sorensen1702@gmail.com</a>.
          Beskriv hvilket indhold det drejer sig om, hvorfor du mener det er ulovligt
          eller krænkende, og hvordan vi kan kontakte dig.
        </p>
        <p>
          Studos-navn, logo, design, tekst, grafik og kode tilhører PlateDigital EMV
          eller relevante rettighedshavere. Du må ikke kopiere eller bruge disse uden
          skriftlig tilladelse, medmindre loven giver dig ret til det.
        </p>
      </article>

      <article id="data" class="legal-section">
        <h2>14. Personoplysninger</h2>
        <p>
          Vi behandler personoplysninger som beskrevet i
          <a href="{{ route('legal.privacy') }}">privatlivspolitikken</a>. Den forklarer,
          hvilke oplysninger vi behandler, hvorfor vi gør det, hvor længe de opbevares,
          og hvilke rettigheder du har.
        </p>
      </article>

      <article id="ansvar" class="legal-section">
        <h2>15. Ansvar</h2>
        <p>
          Studos leveres som en digital tjeneste. Vi arbejder for, at appen er sikker
          og stabil, men kan ikke garantere, at den altid er fejlfri eller tilgængelig.
          Vi er ikke ansvarlige for andre brugeres handlinger eller indhold.
        </p>
        <p>
          Vores ansvar er begrænset i det omfang, dansk lov tillader det. Intet i
          disse vilkår begrænser ansvar, som ikke lovligt kan begrænses, herunder
          ansvar for forsætlige eller groft uagtsomme forhold.
        </p>
      </article>

      <article id="sletning" class="legal-section">
        <h2>16. Opsigelse og sletning</h2>
        <p>
          Du kan til enhver tid slette din konto i appens indstillinger eller via
          <a href="{{ route('legal.delete-account') }}">studos.dk/slet-konto</a>.
          Kontoen lukkes, direkte identifikatorer fjernes eller pseudonymiseres, og
          aktive login- og push-tokens slettes.
        </p>
        <p>
          Fælles historik, for eksempel beskeder, events, dyster og billeder i fælles
          albummer, slettes ikke altid automatisk, fordi det kan påvirke resten af
          klassen. Dit navn erstattes dog med "Slettet bruger", og du kan kontakte
          os om konkrete beskeder eller billeder.
        </p>
        <p>
          Hvis du er eneste aktive ejer af en klasse, skal ejerskabet først overdrages,
          før kontoen kan slettes fuldt ud. Kontakt os, hvis du har brug for hjælp.
        </p>
      </article>

      <article id="aendringer" class="legal-section">
        <h2>17. Ændringer</h2>
        <p>
          Vi kan opdatere vilkårene, når appen ændrer sig, eller når lovgivning eller
          sikkerhedshensyn kræver det. Væsentlige ændringer varsles i appen eller på
          studos.dk, før de træder i kraft, medmindre ændringen skal ske straks af
          sikkerheds- eller lovhensyn.
        </p>
      </article>

      <article id="lov" class="legal-section">
        <h2>18. Lovvalg og klager</h2>
        <p>
          Vilkårene er underlagt dansk ret. Tvister søges først løst ved dialog. Hvis
          en tvist ikke kan løses, afgøres den ved de almindelige danske domstole efter
          de regler, der gælder for forbrugere.
        </p>
        <p>
          Klager om behandling af personoplysninger kan rettes til Datatilsynet. Klager
          om markedsføring kan rettes til Forbrugerombudsmanden.
        </p>
      </article>

      <article id="kontakt" class="legal-section">
        <h2>19. Kontakt</h2>
        <p>
          <strong>PlateDigital EMV</strong><br>
          CVR: 42456187<br>
          Kærmindevej 12, 7441 Bording<br>
          E-mail: <a href="mailto:chris.sorensen1702@gmail.com">chris.sorensen1702@gmail.com</a><br>
          Telefon: <a href="tel:+4520631299">+45 20 63 12 99</a>
        </p>
      </article>
    </div>
  </section>
@endsection
