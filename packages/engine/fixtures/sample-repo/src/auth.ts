// Auth service for token management
export class AuthService {
  private token: string | null = null;

  /** Refresh the auth token from the API */
  async refreshToken(): Promise<string> {
    const response = await fetch("/api/auth/refresh");
    const data = (await response.json()) as { token: string };
    this.token = data.token;
    return this.token;
  }

  getToken(): string | null {
    return this.token;
  }
}

export function validateToken(token: string): boolean {
  return token.length > 0;
}
