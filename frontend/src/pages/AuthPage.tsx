import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Building, Eye, EyeOff, Lock, Mail, User, ShieldAlert } from 'lucide-react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import api from '@/services/api';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  rememberMe: z.boolean().optional(),
});

const registerSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters long'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const { register: registerLogin, handleSubmit: handleLoginSubmit, formState: { errors: loginErrors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { rememberMe: false }
  });

  const { register: registerSignup, handleSubmit: handleSignupSubmit, formState: { errors: registerErrors } } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema)
  });

  const onLogin = async (data: LoginFormValues) => {
    setApiError('');
    setIsLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append('username', data.email);
      formData.append('password', data.password);
      
      const response = await api.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      // If remember me is checked, token persistence could be stored differently,
      // here we just use localStorage (per default project design)
      login(response.data.access_token);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setApiError(e.response?.data?.detail || 'Invalid username or password.');
    } finally {
      setIsLoading(false);
    }
  };

  const onSignup = async (data: RegisterFormValues) => {
    setApiError('');
    setIsLoading(true);
    try {
      await api.post('/auth/register', {
        email: data.email,
        username: data.username,
        password: data.password
      });

      // Log in automatically after registration
      const formData = new URLSearchParams();
      formData.append('username', data.email);
      formData.append('password', data.password);
      
      const loginResponse = await api.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      login(loginResponse.data.access_token);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setApiError(e.response?.data?.detail || 'An error occurred during registration.');
    } finally {
      setIsLoading(false);
    }
  };

  const onGoogleLogin = async (response: CredentialResponse) => {
    setApiError('');
    setIsLoading(true);
    try {
      if (response.credential) {
        const res = await api.post('/auth/google', {
          credential: response.credential
        });
        login(res.data.access_token);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setApiError(e.response?.data?.detail || 'Google Login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-tr from-muted/50 via-background to-primary/5 p-4 animate-fade-in">
      <div className="mb-8 flex items-center gap-3 text-primary scale-100 hover:scale-105 transition-transform duration-300">
        <Building className="h-12 w-12 text-primary" />
        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">PropManage</h1>
      </div>
      
      <Card className="w-full max-w-md shadow-2xl border bg-card/60 backdrop-blur-md transition-all">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-extrabold tracking-tight">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </CardTitle>
          <CardDescription className="text-sm">
            {isLogin ? 'Sign in to access your dashboard' : 'Fill in the credentials to get started'}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {apiError && (
            <div className="p-3 mb-4 flex items-center gap-2 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm font-semibold animate-shake">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>{apiError}</span>
            </div>
          )}

          {isLogin ? (
            <form onSubmit={handleLoginSubmit(onLogin)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-muted-foreground" /> Email Address
                </Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="m@example.com" 
                  className={loginErrors.email ? 'border-destructive focus-visible:ring-destructive' : ''}
                  {...registerLogin('email')} 
                />
                {loginErrors.email && (
                  <p className="text-xs font-semibold text-destructive">{loginErrors.email.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-1.5">
                  <Lock className="h-4 w-4 text-muted-foreground" /> Password
                </Label>
                <div className="relative">
                  <Input 
                    id="password" 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="••••••••" 
                    className={loginErrors.password ? 'border-destructive focus-visible:ring-destructive' : ''}
                    {...registerLogin('password')} 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {loginErrors.password && (
                  <p className="text-xs font-semibold text-destructive">{loginErrors.password.message}</p>
                )}
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input 
                  type="checkbox" 
                  id="rememberMe" 
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  {...registerLogin('rememberMe')}
                />
                <label htmlFor="rememberMe" className="text-sm font-medium text-muted-foreground cursor-pointer select-none">
                  Remember me
                </label>
              </div>

              <Button className="w-full mt-4 h-11 hover:scale-[1.01] transition-all" type="submit" disabled={isLoading}>
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    <span>Signing In...</span>
                  </div>
                ) : 'Sign In'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSignupSubmit(onSignup)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="flex items-center gap-1.5">
                  <User className="h-4 w-4 text-muted-foreground" /> Username
                </Label>
                <Input 
                  id="username" 
                  placeholder="johndoe" 
                  className={registerErrors.username ? 'border-destructive focus-visible:ring-destructive' : ''}
                  {...registerSignup('username')} 
                />
                {registerErrors.username && (
                  <p className="text-xs font-semibold text-destructive">{registerErrors.username.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-muted-foreground" /> Email Address
                </Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="m@example.com" 
                  className={registerErrors.email ? 'border-destructive focus-visible:ring-destructive' : ''}
                  {...registerSignup('email')} 
                />
                {registerErrors.email && (
                  <p className="text-xs font-semibold text-destructive">{registerErrors.email.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-1.5">
                  <Lock className="h-4 w-4 text-muted-foreground" /> Password
                </Label>
                <div className="relative">
                  <Input 
                    id="password" 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="••••••••" 
                    className={registerErrors.password ? 'border-destructive focus-visible:ring-destructive' : ''}
                    {...registerSignup('password')} 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {registerErrors.password && (
                  <p className="text-xs font-semibold text-destructive">{registerErrors.password.message}</p>
                )}
              </div>

              <Button className="w-full mt-4 h-11 hover:scale-[1.01] transition-all" type="submit" disabled={isLoading}>
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    <span>Signing Up...</span>
                  </div>
                ) : 'Sign Up'}
              </Button>
            </form>
          )}

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-muted-foreground/20" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground font-semibold">Or continue with</span>
            </div>
          </div>
          
          <div className="flex justify-center w-full">
            <GoogleLogin
              onSuccess={onGoogleLogin}
              onError={() => {
                setApiError('Google Login failed.');
              }}
              useOneTap
              theme="filled_blue"
              shape="rectangular"
              text={isLogin ? 'signin_with' : 'signup_with'}
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4 border-t pt-4">
          <div className="text-center text-sm text-muted-foreground">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button 
              type="button" 
              onClick={() => { setIsLogin(!isLogin); setApiError(''); }}
              className="text-primary hover:underline font-bold transition-all"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
