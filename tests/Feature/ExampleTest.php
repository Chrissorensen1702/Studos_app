<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    use RefreshDatabase;

    /**
     * A basic test example.
     */
    public function test_homepage_returns_public_landing_page(): void
    {
        $response = $this->get('/');

        $response
            ->assertStatus(200)
            ->assertSee('Studos')
            ->assertSee('CMS ligger bag login');
    }

    public function test_old_index_html_redirects_to_app_url(): void
    {
        $response = $this->get('/index.html');

        $response->assertRedirect(config('app.url'));
    }

    public function test_roles_endpoint_returns_member_access_model(): void
    {
        $response = $this->getJson('/api/roles');

        $response
            ->assertStatus(200)
            ->assertJsonPath('roles.0.id', 'owner')
            ->assertJsonMissing(['id' => 'admin'])
            ->assertJsonPath('statuses.1.id', 'active');
    }

    public function test_schools_endpoint_returns_dropdown_options(): void
    {
        $this->getJson('/api/schools')
            ->assertStatus(200)
            ->assertJsonPath('schools.0.name', 'Midtby Gymnasium');
    }

    public function test_public_class_id_lookup_returns_shareable_class_without_invite_code(): void
    {
        $this->getJson('/api/classes/id/MG-3B-26')
            ->assertStatus(200)
            ->assertJsonPath('class.classId', 'MG-3B-26')
            ->assertJsonPath('class.schoolName', 'Midtby Gymnasium')
            ->assertJsonPath('class.className', '3.B')
            ->assertJsonPath('class.activeMembers', 1)
            ->assertJsonMissingPath('class.inviteCode');
    }

    public function test_personal_code_lookup_returns_safe_member_preview(): void
    {
        $personalCode = DB::table('members')->where('id', 'demo-owner')->value('personal_code');

        $this->assertNotEmpty($personalCode);

        $this->getJson('/api/members/code/'.$personalCode)
            ->assertStatus(200)
            ->assertJsonPath('member.displayName', 'Chris')
            ->assertJsonPath('member.class.classId', 'MG-3B-26')
            ->assertJsonMissingPath('member.email')
            ->assertJsonMissingPath('member.phone')
            ->assertJsonMissingPath('member.birthday');
    }

    public function test_personal_codes_create_consent_based_connection_requests(): void
    {
        DB::table('classes')->insert([
            'id' => 'other-class',
            'public_id' => 'TG-3C-26',
            'school_name' => 'Test Gymnasium',
            'class_name' => '3.C',
            'graduation_year' => '2026',
            'graduation_date' => '2026-06-25',
            'owner_name' => 'Maja Social',
            'owner_email' => 'maja.social@example.test',
            'invite_code' => 'STU-OTHER26',
            'join_policy' => 'approval',
            'allow_member_posts' => true,
            'require_approval_for_photos' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('members')->insert([
            'id' => 'other-member',
            'personal_code' => 'MAJA-DISCO',
            'class_id' => 'other-class',
            'display_name' => 'Maja Social',
            'first_name' => 'Maja',
            'last_name' => 'Social',
            'email' => 'maja.social@example.test',
            'role' => 'student',
            'status' => 'active',
            'joined_at' => now(),
        ]);

        $request = $this->postJson('/api/connections/request', [
            'requesterMemberId' => 'demo-owner',
            'personalCode' => 'MAJA-DISCO',
        ]);

        $request
            ->assertStatus(201)
            ->assertJsonPath('connection.status', 'pending')
            ->assertJsonPath('connection.direction', 'outgoing')
            ->assertJsonPath('connection.otherMember.displayName', 'Maja Social')
            ->assertJsonPath('connection.otherMember.class.classId', 'TG-3C-26')
            ->assertJsonMissingPath('connection.otherMember.email');

        $connectionId = $request->json('connection.id');

        $this->getJson('/api/members/other-member/connections')
            ->assertStatus(200)
            ->assertJsonPath('connections.0.direction', 'incoming')
            ->assertJsonPath('connections.0.status', 'pending');

        $this->postJson('/api/connections/'.$connectionId.'/respond', [
            'memberId' => 'other-member',
            'status' => 'accepted',
        ])
            ->assertStatus(200)
            ->assertJsonPath('connection.status', 'accepted');

        $this->assertDatabaseHas('member_connections', [
            'id' => $connectionId,
            'requester_member_id' => 'demo-owner',
            'receiver_member_id' => 'other-member',
            'status' => 'accepted',
        ]);

        $ownCode = DB::table('members')->where('id', 'demo-owner')->value('personal_code');
        $this->postJson('/api/connections/request', [
            'requesterMemberId' => 'demo-owner',
            'personalCode' => $ownCode,
        ])->assertStatus(422);
    }

    public function test_app_can_resolve_invite_code_and_create_profile(): void
    {
        $classResponse = $this->getJson('/api/classes/invite/STU-DEMO26');
        $classResponse
            ->assertStatus(200)
            ->assertJsonPath('class.id', 'demo-class')
            ->assertJsonPath('class.classId', 'MG-3B-26')
            ->assertJsonPath('class.schoolName', 'Midtby Gymnasium')
            ->assertJsonPath('class.className', '3.B')
            ->assertJsonStructure(['class' => ['schoolId'], 'schools' => [['id', 'name']]])
            ->assertJsonMissingPath('class.members.0.personalCode');

        $this->getJson('/api/classes/invite/STU-DEMO26?memberId=demo-owner')
            ->assertStatus(200)
            ->assertJsonStructure(['class' => ['members' => [['personalCode']]]]);

        $schoolId = $classResponse->json('class.schoolId');

        $response = $this->postJson('/api/classes/join', [
            'inviteCode' => 'STU-DEMO26',
            'schoolId' => $schoolId,
            'firstName' => 'Maja',
            'lastName' => 'Test',
            'email' => 'maja.app@example.test',
            'phone' => '+45 12 34 56 78',
            'birthday' => '2007-05-14',
            'profilePhotoUrl' => 'file:///profile.jpg',
            'password' => 'hemmeligt123',
            'passwordConfirmation' => 'hemmeligt123',
            'termsAccepted' => true,
            'privacyAccepted' => true,
        ]);

        $response
            ->assertStatus(200)
            ->assertJsonPath('session.member.displayName', 'Maja Test')
            ->assertJsonPath('session.member.email', 'maja.app@example.test')
            ->assertJsonPath('session.member.phone', '+45 12 34 56 78')
            ->assertJsonPath('session.member.birthday', '2007-05-14')
            ->assertJsonPath('session.member.profilePhotoUrl', 'file:///profile.jpg')
            ->assertJsonPath('session.member.role', 'student')
            ->assertJsonPath('session.member.status', 'pending')
            ->assertJsonStructure(['session' => ['member' => ['personalCode']]])
            ->assertJsonPath('class.id', 'demo-class')
            ->assertJsonPath('class.classId', 'MG-3B-26');

        $this->assertDatabaseHas('members', [
            'class_id' => 'demo-class',
            'school_id' => $schoolId,
            'first_name' => 'Maja',
            'last_name' => 'Test',
            'email' => 'maja.app@example.test',
            'role' => 'student',
            'status' => 'pending',
            'privacy_version' => '2026-04-26',
        ]);

        $passwordHash = DB::table('members')->where('email', 'maja.app@example.test')->value('password_hash');
        $this->assertNotSame('hemmeligt123', $passwordHash);
        $this->assertTrue(Hash::check('hemmeligt123', $passwordHash));
    }

    public function test_join_rejects_school_that_does_not_match_invite_class(): void
    {
        DB::table('schools')->insert([
            'id' => 'wrong-school',
            'name' => 'Forkert Gymnasium',
            'name_key' => 'forkert-gymnasium',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->postJson('/api/classes/join', [
            'inviteCode' => 'STU-DEMO26',
            'schoolId' => 'wrong-school',
            'firstName' => 'Maja',
            'lastName' => 'Forkert',
            'email' => 'maja.wrong@example.test',
            'birthday' => '2007-05-14',
            'password' => 'hemmeligt123',
            'passwordConfirmation' => 'hemmeligt123',
            'termsAccepted' => true,
            'privacyAccepted' => true,
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Du kan kun joine med den skole, klassen er oprettet paa.');
    }

    public function test_existing_member_can_login_with_email_and_password(): void
    {
        $this->postJson('/api/session/login', [
            'inviteCode' => 'STU-DEMO26',
            'email' => 'chris@skole.dk',
            'password' => 'studos123',
        ])
            ->assertStatus(200)
            ->assertJsonPath('session.member.id', 'demo-owner')
            ->assertJsonPath('session.member.email', 'chris@skole.dk')
            ->assertJsonStructure(['session' => ['member' => ['personalCode']]])
            ->assertJsonPath('class.id', 'demo-class');

        $this->postJson('/api/session/login', [
            'inviteCode' => 'STU-DEMO26',
            'email' => 'chris@skole.dk',
            'password' => 'forkertkode',
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Email eller adgangskode er forkert.');
    }

    public function test_existing_member_can_request_and_verify_login_code(): void
    {
        $codeResponse = $this->postJson('/api/session/request-code', [
            'inviteCode' => 'STU-DEMO26',
            'email' => 'chris@skole.dk',
        ]);

        $codeResponse
            ->assertStatus(200)
            ->assertJsonPath('ok', true)
            ->assertJsonPath('debugCode', '123456');

        $this->postJson('/api/session/verify-code', [
            'inviteCode' => 'STU-DEMO26',
            'email' => 'chris@skole.dk',
            'code' => '123456',
        ])
            ->assertStatus(200)
            ->assertJsonPath('session.member.id', 'demo-owner')
            ->assertJsonPath('session.member.email', 'chris@skole.dk')
            ->assertJsonPath('class.id', 'demo-class');
    }

    public function test_admin_requires_login(): void
    {
        $this->get('/admin')->assertRedirect('/login');
        $this->get('/admin/classes/demo-class')->assertRedirect('/login');
    }

    public function test_demo_class_dashboard_returns_admin_modules_after_login(): void
    {
        $this->post('/login', [
            'email' => 'chris@skole.dk',
            'password' => 'studos123',
        ])->assertRedirect('/admin');

        $this->get('/admin')->assertRedirect('/admin/classes/demo-class');

        $response = $this->get('/admin/classes/demo-class');

        $response
            ->assertStatus(200)
            ->assertSee('Indstillinger')
            ->assertSee('Medlemmer')
            ->assertSee('CMS')
            ->assertSee('Begivenheder');
    }

    public function test_public_create_class_creates_user_and_owner(): void
    {
        DB::table('schools')->insert([
            'id' => 'test-school',
            'name' => 'Test Gymnasium',
            'name_key' => 'test-gymnasium',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->post('/opret-klasse', [
            'ownerName' => 'Maja Test',
            'ownerEmail' => 'maja@example.test',
            'password' => 'hemmeligt123',
            'password_confirmation' => 'hemmeligt123',
            'schoolId' => 'test-school',
            'className' => '3.C',
            'graduationYear' => '2026',
            'graduationDate' => '2026-06-25',
            'joinPolicy' => 'approval',
        ]);

        $response->assertRedirect();
        $this->assertAuthenticated();
        $this->assertStringContainsString('/admin/classes/', $response->headers->get('Location'));
        $this->assertDatabaseHas('users', ['email' => 'maja@example.test']);

        $schoolClass = DB::table('classes')->where('class_name', '3.C')->first();
        $this->assertNotNull($schoolClass);
        $this->assertSame('TG-3C-26', $schoolClass->public_id);

        $this->assertDatabaseHas('members', [
            'class_id' => $schoolClass->id,
            'school_id' => 'test-school',
            'email' => 'maja@example.test',
            'role' => 'owner',
            'status' => 'active',
        ]);
    }

    public function test_authenticated_user_with_class_cannot_create_another_class(): void
    {
        $this->actingAs(User::where('email', 'chris@skole.dk')->firstOrFail());
        $demoSchoolId = DB::table('schools')->where('name', 'Midtby Gymnasium')->value('id');

        $response = $this->post('/admin/classes', [
            'schoolId' => $demoSchoolId,
            'className' => '3.D',
            'graduationYear' => '2026',
            'graduationDate' => '2026-06-24',
            'joinPolicy' => 'approval',
        ]);

        $response
            ->assertRedirect('/admin/classes/demo-class')
            ->assertSessionHasErrors('class');

        $schoolClass = DB::table('classes')->where('class_name', '3.D')->first();
        $this->assertNull($schoolClass);
    }

    public function test_authenticated_user_without_class_can_create_one_from_admin(): void
    {
        $user = User::factory()->create([
            'name' => 'No Class',
            'email' => 'noclass@example.test',
        ]);
        DB::table('schools')->insert([
            'id' => 'admin-school',
            'name' => 'Admin Gymnasium',
            'name_key' => 'admin-gymnasium',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($user);

        $this->get('/admin')
            ->assertStatus(200)
            ->assertSee('Opret din klasse')
            ->assertSee('Vælg skole')
            ->assertSee('Ingen klasse endnu');

        $response = $this->post('/admin/classes', [
            'schoolId' => 'admin-school',
            'className' => '3.D',
            'graduationYear' => '2026',
            'graduationDate' => '2026-06-24',
            'joinPolicy' => 'approval',
        ]);

        $response->assertRedirect();
        $this->assertStringContainsString('/admin/classes/', $response->headers->get('Location'));

        $schoolClass = DB::table('classes')->where('class_name', '3.D')->first();
        $this->assertNotNull($schoolClass);
        $this->assertSame('AG-3D-26', $schoolClass->public_id);
        $this->assertDatabaseHas('members', [
            'class_id' => $schoolClass->id,
            'school_id' => 'admin-school',
            'email' => 'noclass@example.test',
            'role' => 'owner',
        ]);
    }
}
