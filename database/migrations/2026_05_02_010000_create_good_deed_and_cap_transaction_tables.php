<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('good_deed_weeks')) {
            Schema::create('good_deed_weeks', function (Blueprint $table): void {
                $table->string('id', 36)->primary();
                $table->unsignedTinyInteger('week_number')->unique();
                $table->string('title', 190);
                $table->text('description')->nullable();
                $table->string('verification_hint', 190)->nullable();
                $table->unsignedInteger('base_caps')->default(100);
                $table->unsignedInteger('photo_bonus_caps')->default(0);
                $table->dateTime('created_at')->nullable();
                $table->dateTime('updated_at')->nullable();
            });
        }

        if (Schema::hasTable('good_deed_weeks')) {
            $now = now()->format('Y-m-d H:i:s');

            foreach ($this->weeklyGoodDeeds() as $week) {
                DB::table('good_deed_weeks')->updateOrInsert(
                    ['id' => sprintf('weekly-good-deed-%02d', $week['week_number'])],
                    [
                        ...$week,
                        'base_caps' => 25,
                        'photo_bonus_caps' => 0,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ],
                );
            }
        }

        if (! Schema::hasTable('good_deed_claims')) {
            Schema::create('good_deed_claims', function (Blueprint $table): void {
                $table->string('id', 36)->primary();
                $table->string('week_key', 16)->index();
                $table->string('good_deed_week_id', 36)->index();
                $table->string('class_id', 36)->index();
                $table->string('member_id', 36)->index();
                $table->string('verifier_member_id', 36)->index();
                $table->text('photo_url')->nullable();
                $table->string('status', 32)->default('pending')->index();
                $table->unsignedInteger('base_caps')->default(100);
                $table->unsignedInteger('photo_bonus_caps')->default(0);
                $table->dateTime('approved_at')->nullable();
                $table->dateTime('rejected_at')->nullable();
                $table->dateTime('expires_at')->nullable()->index();
                $table->dateTime('created_at')->nullable();
                $table->dateTime('updated_at')->nullable();
                $table->index(['week_key', 'member_id']);
                $table->index(['week_key', 'verifier_member_id', 'status']);
                $table->foreign('good_deed_week_id')->references('id')->on('good_deed_weeks');
                $table->foreign('class_id')->references('id')->on('classes')->cascadeOnDelete();
                $table->foreign('member_id')->references('id')->on('members')->cascadeOnDelete();
                $table->foreign('verifier_member_id')->references('id')->on('members')->cascadeOnDelete();
            });
        }

        if (! Schema::hasTable('cap_transactions')) {
            Schema::create('cap_transactions', function (Blueprint $table): void {
                $table->string('id', 36)->primary();
                $table->string('member_id', 36)->index();
                $table->string('class_id', 36)->index();
                $table->integer('amount');
                $table->string('type', 64)->index();
                $table->string('description', 190)->nullable();
                $table->string('source_type', 64)->nullable()->index();
                $table->string('source_id', 36)->nullable()->index();
                $table->string('created_by_member_id', 36)->nullable()->index();
                $table->json('metadata')->nullable();
                $table->dateTime('created_at')->index();
                $table->foreign('member_id')->references('id')->on('members')->cascadeOnDelete();
                $table->foreign('class_id')->references('id')->on('classes')->cascadeOnDelete();
                $table->foreign('created_by_member_id')->references('id')->on('members')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('cap_transactions');
        Schema::dropIfExists('good_deed_claims');
        Schema::dropIfExists('good_deed_weeks');
    }

    private function weeklyGoodDeeds(): array
    {
        $titles = [
            'Giv et kompliment til en fra klassen',
            'Hjælp en med noter, oplader eller en lille praktisk ting',
            'Invitér en med i pausen',
            'Del en nyttig reminder i klassechatten',
            'Læg et godt hverdagsbillede i galleriet',
            'Sig hej til en fra parallelklassen',
            'Tag en ekstra stol med til bordet',
            'Ryd en kop, tallerken eller flaske op',
            'Svar på en event-invitation i god tid',
            'Hjælp en med at finde lokale eller tidspunkt',
            'Send en positiv besked til en klassekammerat',
            'Start en fælles pauseaktivitet',
            'Del et hurtigt eksamenstip',
            'Hjælp med teknikken før en fremlæggelse',
            'Tag initiativ til et klassefoto med samtykke',
            'Lav en hurtig afstemning om noget fælles',
            'Find en glemt ting og post den i chatten',
            'Sæt en sang på fælles playlist',
            'Giv plads til en der kommer for sent',
            'Hjælp en med at indhente en besked',
            'Mind klassen om en vigtig dato',
            'Del et godt læsested eller en god pauseidé',
            'Hjælp med at samle billeder fra dagen',
            'Gør en fælles aftale lidt tydeligere',
            'Vær den første til at svare konstruktivt',
            'Giv en high-five eller fist bump',
            'Spørg en stille person om de vil være med',
            'Tag en lille oprydningsrunde',
            'Del en praktisk pakkeliste eller huskeliste',
            'Hjælp en med transport eller planlægning',
            'Skriv en tak til en i klassen',
            'Gør plads ved bordet',
            'Hent eller del noget praktisk til gruppen',
            'Giv feedback på en idé',
            'Tjek ind på en klassekammerat',
            'Del et link, der hjælper klassen',
            'Hjælp en anden gruppe med et hurtigt spørgsmål',
            'Lav en positiv kommentar i chatten',
            'Mind en om at huske mad eller vand',
            'Tag ansvar for én lille fælles ting',
            'Hjælp med at få en aftale i kalenderen',
            'Del et billede fra en god klasse-stemning',
            'Giv nogen credit for noget de gjorde',
            'Svar hurtigt på en praktisk klassebesked',
            'Få en ny person med i snakken',
            'Ryd op efter dig selv og én ekstra ting',
            'Hjælp en med at øve en kort præsentation',
            'Lav en venlig reminder uden spam',
            'Bidrag med én god idé til klassen',
            'Hjælp med at finde et tabt item',
            'Gør en fælles plan lettere at forstå',
            'Ugens wildcard: gør én lille god ting for klassen',
        ];

        return array_map(
            fn (string $title, int $index): array => [
                'week_number' => $index + 1,
                'title' => $title,
                'description' => 'Lav ugens gode gerning og claim dine Caps.',
                'verification_hint' => 'Kan kun claimes én gang pr. uge.',
            ],
            $titles,
            array_keys($titles),
        );
    }
};
