export declare function register(email: string, password: string, displayName?: string): Promise<any>;
export declare function login(email: string, password: string): Promise<{
    user: any;
    accessToken: string;
    refreshToken: string;
}>;
export declare function rotate(refreshToken: string): Promise<{
    accessToken: string;
}>;
export declare function logout(refreshToken: string): Promise<{
    ok: boolean;
}>;
//# sourceMappingURL=auth.service.d.ts.map