<!doctype html>
<html lang="da">
  <body style="font-family: Arial, sans-serif; color: #172143; line-height: 1.5;">
    <h1>Du er inviteret til Studos</h1>
    <p>Hej {{ $displayName }}</p>
    <p>Du er blevet tilføjet til {{ $className }} på {{ $schoolName }}.</p>
    <p>Brug klassekoden her for at oprette din profil:</p>
    <p style="font-size: 22px; font-weight: 700; letter-spacing: 0.04em;">{{ $inviteCode }}</p>
    <p>
      <a href="{{ $inviteUrl }}">Åbn Studos</a>
    </p>
  </body>
</html>
