import { Ability } from '@casl/ability';

export abstract class IAbilityFactory {
    abstract createForUser: (user: any) => Promise<Ability>;
}

export interface Permission {
    resource: string;
    action: string;
}
