import type { Container } from "./interfaces.js";

export function createToken<T>(name: string): symbol & { __type?: T } {
  return Symbol.for(`contextoptimizer:${name}`) as symbol & { __type?: T };
}

export function createContainer(): Container {
  const factories = new Map<symbol, () => unknown>();
  const instances = new Map<symbol, unknown>();

  return {
    register<T>(token: symbol & { __type?: T }, factory: () => T): void {
      factories.set(token, factory);
      instances.delete(token);
    },

    resolve<T>(token: symbol & { __type?: T }): T {
      if (instances.has(token)) {
        return instances.get(token) as T;
      }

      const factory = factories.get(token);
      if (!factory) {
        throw new Error(`Service not registered: ${String(token.description ?? token)}`);
      }

      const instance = factory() as T;
      instances.set(token, instance);
      return instance;
    },

    has(token: symbol & { __type?: unknown }): boolean {
      return factories.has(token);
    },
  };
}
