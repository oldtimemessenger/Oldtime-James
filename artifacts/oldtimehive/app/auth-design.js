import "./auth-brand.css";

const esc = value => String(value ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const art = url => `<div class="ot-art"><img src="${esc(url)}" alt="Oldtime feather" /><span class="ot-brand-name">Oldtime</span></div>`;

export function loginMarkup(brandArtUrl) {
  return `<div class="stage"><div class="phone"><div class="auth ot-auth ot-auth-login">
    ${art(brandArtUrl)}
    <h1>Sign in</h1>
    <div id="cognito-sign-in" style="display:contents"></div>
    <form class="auth-form" id="login-form">
      <label class="ot-label" for="email">Username or email
        <input class="field" id="email" name="username" type="text" autocomplete="username" placeholder="Username or email" required />
      </label>
      <label class="ot-label" for="pass">Password
        <input class="field" id="pass" name="password" type="password" autocomplete="current-password" placeholder="Password" required />
      </label>
      <p class="sub" id="err" role="alert"></p>
      <button class="btn primary" id="login" type="submit">Sign in</button>
    </form>
    <div class="ot-switch">
      <span>New to Oldtime?</span>
      <button class="btn auth-link" id="signup" type="button">Sign up</button>
    </div>
  </div></div></div>`;
}

export function signupMarkup(brandArtUrl, interests = []) {
  const safe = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  return `<div class="stage"><div class="phone"><div class="auth ot-auth">
    ${art(brandArtUrl)}
    <button class="auth-step-back" id="signup-step-back" type="button" aria-label="Go back to the previous signup step" hidden>‹</button>
    <p class="ot-eyebrow">Join Oldtime</p>
    <h1 id="signup-title">What’s your name?</h1>
    <p class="ot-lede" id="signup-lede">Enter the name you use in real life.</p>
    <div id="cognito-sign-in" style="display:contents"></div>
    <form class="auth-form signup-form" id="signup-form" autocomplete="off" novalidate>
      <section class="signup-step" data-signup-step="0">
        <div class="signup-name-fields">
          <label class="ot-label" for="su-first">First name
            <input class="field" id="su-first" name="given-name" type="text" autocomplete="given-name" maxlength="40" placeholder="First name" required />
          </label>
          <label class="ot-label" for="su-last">Last name
            <input class="field" id="su-last" name="family-name" type="text" autocomplete="family-name" maxlength="40" placeholder="Last name" required />
          </label>
        </div>
        <button class="btn primary signup-next" type="button">Next</button>
      </section>
      <section class="signup-step" data-signup-step="1" hidden>
        <label class="ot-label" for="su-email">Email address
          <input class="field" id="su-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required />
        </label>
        <label class="ot-label" for="su-user">Username <small id="su-user-help">3–24 letters, numbers, or underscores.</small>
          <input class="field" id="su-user" name="new-username" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" minlength="3" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" aria-describedby="su-user-help" placeholder="Choose a username" required />
        </label>
        <button class="btn primary signup-next" type="button">Next</button>
      </section>
      <section class="signup-step" data-signup-step="2" hidden>
        <label class="ot-label" for="su-birthday">Birthday <small>Your birthday is private and won’t appear on your public profile.</small>
          <input class="field" id="su-birthday" name="bday" type="date" autocomplete="bday" required />
        </label>
        <button class="btn primary signup-next" type="button">Next</button>
      </section>
      <section class="signup-step signup-interests-step" data-signup-step="3" hidden>
        <fieldset class="signup-interests" aria-describedby="su-interest-count">
          <legend class="ot-label">Interests <small>Pick at least 3. You can change your interests later.</small></legend>
          <div class="signup-interest-grid">${interests.map(item => `<button type="button" class="signup-interest" data-signup-interest="${safe(item.id)}" data-testid="button-signup-interest-${safe(item.id)}" aria-pressed="false">${safe(item.label)}</button>`).join("")}</div>
          <p class="signup-interest-count" id="su-interest-count" data-testid="text-signup-interest-count" aria-live="polite">0 of 3 minimum selected</p>
        </fieldset>
        <label class="signup-follow-oldtime" for="su-follow-oldtime">
          <input id="su-follow-oldtime" type="checkbox" data-testid="checkbox-follow-oldtime" />
          <span><b>Follow @oldtime for app updates</b><small>Optional. You can turn this off now or unfollow anytime.</small></span>
        </label>
        <button class="btn primary signup-next" type="button">Next</button>
      </section>
      <section class="signup-step" data-signup-step="4" hidden>
        <label class="ot-label" for="su-pass">Password <small>Use at least 8 characters.</small>
          <input class="field" id="su-pass" name="new-password" type="password" autocomplete="new-password" placeholder="Password" minlength="8" maxlength="128" required />
        </label>
        <p class="signup-age-note">Oldtime is for people 16 and older.</p>
        <button class="btn primary" id="go" type="submit">Create account</button>
      </section>
      <p class="sub" id="err" role="alert"></p>
      <p class="sub auth-success" id="signup-status" role="status" aria-live="polite"></p>
    </form>
    <button class="btn ghost signup-login" id="back" type="button" aria-label="Log in to an existing account">Log in</button>
  </div></div></div>`;
}
