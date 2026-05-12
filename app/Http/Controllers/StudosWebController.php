<?php

namespace App\Http\Controllers;

use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;

class StudosWebController extends Controller
{
    public function landing(): View
    {
        return view('home');
    }

    public function about(): View
    {
        return view('about');
    }

    public function faq(): View
    {
        return view('faq');
    }

    public function terms(): View
    {
        return view('legal.terms');
    }

    public function privacy(): View
    {
        return view('legal.privacy');
    }

    public function cookies(): View
    {
        return view('legal.cookies');
    }

    public function deleteAccount(): View
    {
        return view('legal.delete-account');
    }

    public function redirectToHome(): RedirectResponse
    {
        return redirect()->route('home');
    }
}
