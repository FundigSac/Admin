"use client";

import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowElbowDownLeft,
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  Buildings,
  CalendarBlank,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  CaretUpDown,
  ChatsCircle,
  CheckCircle,
  ClipboardText,
  Clock,
  Copy,
  DesktopTower,
  DeviceMobile,
  DotsThreeVertical,
  DownloadSimple,
  EnvelopeSimple,
  EnvelopeSimpleOpen,
  GearSix,
  HourglassMedium,
  IdentificationBadge,
  Info,
  Question,
  List,
  LockKey,
  MagnifyingGlass,
  MapPin,
  Moon,
  PaperPlaneTilt,
  PencilSimple,
  Phone,
  Plus,
  Prohibit,
  Pulse,
  Scales,
  SignOut,
  SquaresFour,
  Sun,
  Trash,
  UserPlus,
  UsersThree,
  Warning,
  WarningCircle,
  WhatsappLogo,
  X,
  type Icon as PhosphorIcon,
  type IconProps,
  type IconWeight,
} from "@phosphor-icons/react";

// Un solo juego de íconos para todo el panel (Phosphor). La navegación y los íconos de identidad usan el estilo
// dúotono: trazo en la tinta y una capa tenue del mismo color, que en el ítem activo toma el azul de FUNDIGSAC.
// Los controles pequeños usan el trazo regular para leerse limpios a 14-16px. Todos son decorativos por defecto.

export type AppIcon = (props: IconProps) => React.ReactElement;

function make(C: PhosphorIcon, weight: IconWeight): AppIcon {
  const Wrapped = (props: IconProps) => <C weight={weight} aria-hidden="true" focusable="false" {...props} />;
  Wrapped.displayName = `Icon(${C.displayName ?? "phosphor"})`;
  return Wrapped;
}

const duo = (C: PhosphorIcon) => make(C, "duotone");
const line = (C: PhosphorIcon) => make(C, "regular");
const bold = (C: PhosphorIcon) => make(C, "bold");

/* Navegación y módulos */
export const IconOverview = duo(SquaresFour);
export const IconUsers = duo(UsersThree);
export const IconQuotes = duo(ClipboardText);
export const IconInquiries = duo(ChatsCircle);
export const IconComplaints = duo(BookOpenText);
export const IconPrivacy = duo(LockKey);
export const IconActivity = duo(Pulse);
export const IconRoles = duo(IdentificationBadge);
export const IconSettings = duo(GearSix);
export const IconLegal = duo(Scales);
export const IconMailSent = duo(EnvelopeSimpleOpen);
export const IconInfo = duo(Info);
export const IconHelp = duo(Question);

/* Estados (siempre con texto al lado) */
export const IconActive = make(CheckCircle, "fill");
export const IconPending = make(HourglassMedium, "fill");
export const IconBlocked = make(Prohibit, "bold");
export const IconAlert = make(WarningCircle, "fill");
export const IconWarning = make(Warning, "fill");
export const IconSuccess = make(CheckCircle, "fill");

/* Controles */
export const IconSearch = bold(MagnifyingGlass);
export const IconMenu = bold(List);
export const IconClose = bold(X);
export const IconSignOut = line(SignOut);
export const IconUpDown = bold(CaretUpDown);
export const IconEnter = bold(ArrowElbowDownLeft);
export const IconRefresh = bold(ArrowClockwise);
export const IconUndo = line(ArrowCounterClockwise);
export const IconSun = duo(Sun);
export const IconMoon = duo(Moon);
export const IconArrowLeft = bold(ArrowLeft);
export const IconArrowRight = bold(ArrowRight);
export const IconChevronLeft = bold(CaretLeft);
export const IconChevronRight = bold(CaretRight);
export const IconSortUp = bold(CaretUp);
export const IconSortDown = bold(CaretDown);
export const IconMore = bold(DotsThreeVertical);
export const IconPlus = bold(Plus);
export const IconUserPlus = line(UserPlus);
export const IconExport = line(DownloadSimple);
export const IconEdit = line(PencilSimple);
export const IconTrash = line(Trash);
export const IconCopy = line(Copy);
export const IconSend = line(PaperPlaneTilt);

/* Datos */
export const IconMail = line(EnvelopeSimple);
export const IconPhone = line(Phone);
export const IconCompany = line(Buildings);
export const IconPlace = line(MapPin);
export const IconCalendar = line(CalendarBlank);
export const IconClock = line(Clock);
export const IconMobile = line(DeviceMobile);
export const IconDesktop = line(DesktopTower);
export const IconWhatsapp = line(WhatsappLogo);
