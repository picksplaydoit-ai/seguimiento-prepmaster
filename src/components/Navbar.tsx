import { useState } from 'react';
import { LogOut, Menu, X, User, BookOpen, GraduationCap } from 'lucide-react';
import { auth } from '../config/firebase';
import { UserRole } from '../types';

interface NavbarProps {
  user: {
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
  };
  role: UserRole;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Navbar({ user, role, onLogout, activeTab, setActiveTab }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const teacherNavigation = [
    { id: 'dashboard', name: 'Mi Panel' },
    { id: 'groups', name: 'Gestión de Grupos' },
    { id: 'attendance', name: 'Pase de Lista' },
    { id: 'grades', name: 'Calificaciones' },
  ];

  const studentNavigation = [
    { id: 'dashboard', name: 'Mi Avance' },
    { id: 'grades', name: 'Mis Notas' },
    { id: 'attendance', name: 'Asistencia' },
  ];

  const navigation = role === 'teacher' ? teacherNavigation : studentNavigation;

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center space-x-2">
              <div className="bg-blue-600 text-white p-2 rounded-xl">
                <GraduationCap className="h-6 w-6" id="logo-icon" />
              </div>
              <span className="text-xl font-bold text-slate-800 tracking-tight font-sans" id="brand-name">
                PrepMaster
              </span>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex md:ml-8 md:space-x-4">
              {navigation.map((item) => (
                <button
                  key={item.id}
                  id={`nav-item-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
                    activeTab === item.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>

          {/* User Profile & Actions */}
          <div className="hidden md:flex md:items-center md:space-x-4">
            <div className="flex items-center space-x-3 bg-slate-50 py-1.5 pl-3 pr-4 rounded-full border border-slate-200">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  referrerPolicy="no-referrer"
                  alt={user.displayName || "Avatar"}
                  className="h-8 w-8 rounded-full border border-slate-300"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  <User className="h-4 w-4" />
                </div>
              )}
              <div className="text-left">
                <p className="text-xs font-semibold text-slate-800 leading-none">
                  {user.displayName || "Usuario"}
                </p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                  {role === 'teacher' ? 'Profesor' : 'Alumno'}
                </p>
              </div>
            </div>

            <button
              onClick={onLogout}
              id="btn-logout-desktop"
              className="inline-flex items-center space-x-1.5 px-4 py-2 border border-slate-200 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 hover:text-red-600 hover:border-red-200 focus:outline-none transition-all duration-150"
            >
              <LogOut className="h-4 w-4" />
              <span>Salir</span>
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              id="mobile-menu-hamburger"
              className="inline-flex items-center justify-center p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-50 focus:outline-none"
            >
              <span className="sr-only">Abrir menú</span>
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-2 pt-2 pb-4 space-y-1">
          {navigation.map((item) => (
            <button
              key={item.id}
              id={`nav-item-mobile-${item.id}`}
              onClick={() => {
                setActiveTab(item.id);
                setIsOpen(false);
              }}
              className={`block w-full text-left px-4 py-3 rounded-xl text-base font-medium transition-all duration-150 ${
                activeTab === item.id
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {item.name}
            </button>
          ))}
          <div className="pt-4 pb-2 border-t border-slate-100 mt-4 px-4 flex items-center space-x-3">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                referrerPolicy="no-referrer"
                alt="Avatar"
                className="h-10 w-10 rounded-full"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold">
                <User className="h-5 w-5" />
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-slate-800">{user.displayName}</p>
              <p className="text-xs text-slate-500 font-mono">{role === 'teacher' ? 'Profesor' : 'Alumno'}</p>
            </div>
          </div>
          <div className="px-2 mt-2">
            <button
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              id="btn-logout-mobile"
              className="flex w-full items-center justify-center space-x-2 px-4 py-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl font-medium text-sm transition-all duration-150"
            >
              <LogOut className="h-5 w-5" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
