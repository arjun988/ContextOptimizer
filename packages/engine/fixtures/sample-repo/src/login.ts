import { AuthService } from "./auth.js";

export class LoginController {
  private auth = new AuthService();

  async login(username: string, password: string): Promise<boolean> {
    const token = await this.auth.refreshToken();
    return token.length > 0;
  }
}
