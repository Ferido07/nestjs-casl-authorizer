import { applyDecorators, CanActivate, ExecutionContext, Injectable, SetMetadata, UseGuards } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable } from "rxjs"
import { IAbilityFactory, Permission } from "./interfaces";


export const IS_PUBLIC_METADATA_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_METADATA_KEY, true);

export const PERMISSIONS_METADATA_KEY = "permissions"
const RESOURCE_METADATA_KEY = "resource"
const ACTIONS_CALLBACKS = "actionsCallbacks"

export const Permissions = (permissions: Permission[]) =>  {
    return SetMetadata(PERMISSIONS_METADATA_KEY, permissions);
}

export const AuthorizePermissions = (permissions: Permission[]) =>  {
    return applyDecorators(
        SetMetadata(PERMISSIONS_METADATA_KEY, permissions),
        UseGuards(PermissionsGuard),
    );
}

export const Resource = (resource: string) => {
    const decorator: ClassDecorator = (target) => {
        Reflect.defineMetadata(RESOURCE_METADATA_KEY, resource, target.prototype);

        let actionsFns: Array<() => void> = Reflect.getMetadata(ACTIONS_CALLBACKS, target.prototype);
        if (actionsFns) {
            actionsFns.forEach(fn => fn());
        }
        return target;
    }
    return decorator;
}

export const Actions = (...action: string[]) => {
    const decoratorFactory: MethodDecorator = (target, propertyKey, descriptor) => {

        let actionsFns: Array<() => void> = Reflect.getMetadata(ACTIONS_CALLBACKS, target);
        if (!actionsFns) {
            Reflect.defineMetadata(ACTIONS_CALLBACKS, actionsFns = [], target);
        }
        actionsFns.push(() => {
            if (descriptor) {
                const resource: string = Reflect.getMetadata(RESOURCE_METADATA_KEY, target);
                if (resource && typeof resource === "string") {
                    const prms: Permission[] = action.map(a => ({ resource, action: a}));
    
                    // let permissions: Permission[] = Reflect.getMetadata(PERMISSIONS_METADATA_KEY, target, propertyKey);
                    // if (Array.isArray(permissions)) {
                    //     permissions.push(...prms);
                    // } else {
                    //     permissions = prms;
                    // }
                    console.log("Permissions -> ", prms);
                    Reflect.defineMetadata(PERMISSIONS_METADATA_KEY, prms, descriptor.value);
                    // return descriptor;
                }
            }
        });
    };
    return decoratorFactory;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
    constructor(private reflector: Reflector, private factory: IAbilityFactory) {}

    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        
        const isPublic: boolean = this.reflector.getAllAndOverride<boolean, string>(
            IS_PUBLIC_METADATA_KEY, [context.getHandler(), context.getClass()]
        );
        
        if (isPublic) {
            return true;
        }
        
        // Get required permissions
        const requiredPermissions: Permission[] = this.reflector.getAllAndMerge<Permission[], string>(
            PERMISSIONS_METADATA_KEY, [context.getClass(), context.getHandler()]
        );
        // console.log("Required permissions -> ", requiredPermissions);
        
        if (Array.isArray(requiredPermissions) && requiredPermissions.length > 0) {
            // There are some required permissions to be fulfilled

            // Get user
            const user = context.switchToHttp().getRequest().user;
            if (!user) {
                return false;
            }
            // Get user's permissions from factory provider
            return this.factory.createForUser(user).then(ability => {
                return requiredPermissions.some(p => {
                    return ability.can(p.action, p.resource);
                })
            });
        } 
        return true;
    }

}
