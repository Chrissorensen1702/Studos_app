<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class MemberInvitationMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public readonly string $displayName,
        public readonly string $className,
        public readonly string $schoolName,
        public readonly string $inviteCode,
        public readonly string $inviteUrl,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Invitation til '.$this->className.' på Studos',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.member-invitation',
        );
    }
}
