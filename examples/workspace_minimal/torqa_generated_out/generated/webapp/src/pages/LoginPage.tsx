import React from "react";

export function LoginPage() {
  return (
    <section className="page" aria-labelledby="login-title">
      <h2 id="login-title">Sign in</h2>
      <form>
        <div className="field">
          <label htmlFor="password">password</label>
          <input id="password" name="password" type="password" />
        </div>
        <div className="field">
          <label htmlFor="username">username</label>
          <input id="username" name="username" type="text" />
        </div>
        <button type="submit">Sign in</button>
      </form>
    </section>
  );
}
