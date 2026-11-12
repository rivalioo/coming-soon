/* eslint-disable react-refresh/only-export-components */

import React, { createContext, useContext, useState } from 'react';
import { supabase } from '../lib/supabase';

interface User {
    id: string;
    email?: string;
    username?: string;
}

interface RegisteredUser extends User {
    registered_at?: string;
}

interface AuthContextType {
    isAuthenticated: boolean;
    user: User | null;
    login: () => void;
    logout: () => Promise<void>;
    register: (userData: User) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType>({
    isAuthenticated: false,
    user: null,
    login: () => { },
    logout: async () => { },
    register: async () => ({ success: false }),
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    const login = () => {
        // Mock login for coming soon app
        const mockUser: User = {
            id: 'demo-user',
            email: 'demo@rivallio.com',
            username: 'DemoUser'
        };
        setUser(mockUser);
        setIsAuthenticated(true);
    };

    const register = async (userData: User): Promise<{ success: boolean; error?: string }> => {
        try {
            // Try Supabase first
            if (supabase) {
                console.log('📝 Registering user with Supabase Auth (same table as main app)...');

                // Check if username already exists in users table
                const { data: existingUsername } = await supabase
                    .from('users')
                    .select('id')
                    .eq('username', userData.username || '')
                    .single();

                if (existingUsername) {
                    return { success: false, error: 'username_taken' };
                }

                // Create user with Supabase Auth (this creates entry in auth.users AND users table)
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email: userData.email || '',
                    password: 'TempPassword123!', // Temporary password - user will reset on first login
                    options: {
                        data: {
                            username: userData.username,
                            name: userData.username, // Use username as name for now
                            is_coming_soon_registration: true, // Flag to identify coming-soon registrations
                        },
                        emailRedirectTo: undefined, // Don't send confirmation email for coming soon
                    }
                });

                if (authError) {
                    console.error('Supabase Auth error:', authError);

                    // Check for specific errors
                    if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
                        return { success: false, error: 'email_exists' };
                    }

                    throw authError;
                }

                if (!authData.user) {
                    throw new Error('User creation failed');
                }

                // Important: Sign out immediately so they don't get logged in
                await supabase.auth.signOut();

                console.log('✅ User registered successfully in Supabase (users table)!');
                return { success: true };
            }

            // Fallback to localStorage
            console.log('📝 Registering user with localStorage (Supabase not configured)...');

            const registeredUsers: RegisteredUser[] = JSON.parse(localStorage.getItem('rivalioo_registered_users') || '[]');

            // Check duplicates
            const emailExists = registeredUsers.some((u) =>
                userData.email && u.email?.toLowerCase() === userData.email.toLowerCase()
            );
            if (emailExists) {
                return { success: false, error: 'email_exists' };
            }

            const usernameTaken = registeredUsers.some((u) =>
                userData.username && u.username?.toLowerCase() === userData.username.toLowerCase()
            );
            if (usernameTaken) {
                return { success: false, error: 'username_taken' };
            }

            // Store in localStorage
            localStorage.setItem('rivalioo_registered_users', JSON.stringify([
                ...registeredUsers,
                { ...userData, registered_at: new Date().toISOString() }
            ]));

            console.log('✅ User registered successfully in localStorage!');
            return { success: true };
        } catch (error: unknown) {
            console.error('Registration error:', error);
            const message = error instanceof Error ? error.message : 'Registration failed';
            return { success: false, error: message };
        }
    };

    const logout = async () => {
        setUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem('rivalioo_user');
    };

    return (
        <AuthContext.Provider value={{
            isAuthenticated,
            user,
            login,
            logout,
            register
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
