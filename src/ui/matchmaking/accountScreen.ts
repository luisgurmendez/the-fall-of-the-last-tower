/**
 * The account on the menu: a line under the main menu's links (signed out,
 * "Sign in"; signed in, the name, rating and tier, wins and losses,
 * "Profile" and "Sign out"), and the
 * screen to sign in or create an account (a name, a password, the error if
 * any). Accounts are optional: guests play as before.
 */

import { accountErrorMessage, type AccountClient, type StoredAccount } from "./account";
import { ratingLine } from "./profileFormat";

export class AccountScreen {
  private readonly line = getEl("menu-account");
  private readonly nameInput = getEl("account-name") as HTMLInputElement;
  private readonly passwordInput = getEl("account-password") as HTMLInputElement;
  private readonly error = getEl("account-error");
  private readonly signInButton = getEl("btn-account-login") as HTMLButtonElement;
  private readonly signUpButton = getEl("btn-account-register") as HTMLButtonElement;
  private busy = false;

  constructor(
    private readonly client: AccountClient,
    /** Show a menu screen: the account screen, or back to the menu */
    private readonly show: (screen: "account" | "menu") => void,
    /** Open an account's profile (profileScreen.ts) */
    private readonly openProfile: (name: string) => void,
  ) {
    this.signInButton.addEventListener("click", () => this.submit("login"));
    this.signUpButton.addEventListener("click", () => this.submit("register"));
    this.passwordInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") this.submit("login");
    });
    getEl("btn-account-back").addEventListener("click", () => this.show("menu"));
    client.subscribe(current => this.renderLine(current));
    this.renderLine(client.current());
    // The latest wins and losses (and a session the server dropped)
    void client.refresh();
  }

  /** Open the sign-in screen */
  open(): void {
    this.error.textContent = "";
    this.passwordInput.value = "";
    this.show("account");
    this.nameInput.focus();
  }

  private async submit(action: "login" | "register"): Promise<void> {
    if (this.busy) return;
    const name = this.nameInput.value.trim();
    const password = this.passwordInput.value;
    if (name === "" || password === "") {
      this.error.textContent = "Type a name and a password";
      return;
    }
    this.setBusy(true);
    const answer = action === "login" ? await this.client.login(name, password) : await this.client.register(name, password);
    this.setBusy(false);
    if (answer.ok) {
      this.passwordInput.value = "";
      this.show("menu");
    } else {
      this.error.textContent = accountErrorMessage(answer.error);
    }
  }

  private setBusy(busy: boolean): void {
    this.busy = busy;
    this.signInButton.disabled = busy;
    this.signUpButton.disabled = busy;
  }

  /** The line under the menu's links */
  private renderLine(current: StoredAccount | null): void {
    if (!current) {
      const signIn = document.createElement("span");
      signIn.className = "menu-link";
      signIn.textContent = "Sign in";
      signIn.addEventListener("click", () => this.open());
      const note = document.createElement("span");
      note.className = "menu-account-note";
      note.textContent = "Playing as a guest";
      this.line.replaceChildren(note, signIn);
      return;
    }
    const { name, wins, losses } = current.account;
    const who = document.createElement("span");
    who.className = "menu-account-name";
    who.textContent = name;
    const rating = document.createElement("span");
    rating.className = "menu-account-rating";
    rating.textContent = ratingLine(current.account);
    const record = document.createElement("span");
    record.className = "menu-account-note";
    record.textContent = `${wins}W ${losses}L`;
    const profile = document.createElement("span");
    profile.className = "menu-link";
    profile.textContent = "Profile";
    profile.addEventListener("click", () => this.openProfile(name));
    const signOut = document.createElement("span");
    signOut.className = "menu-link";
    signOut.textContent = "Sign out";
    signOut.addEventListener("click", () => void this.client.logout());
    this.line.replaceChildren(who, rating, record, profile, signOut);
  }
}

function getEl(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element;
}
