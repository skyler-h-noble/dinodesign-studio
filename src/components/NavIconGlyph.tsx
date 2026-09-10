/**
 * One icon by name.
 *
 * A curated map rather than a dynamic import of MUI's whole set: an icon
 * offered in the picker has to be one a designer can also find in Figma, and a
 * name that resolves to nothing renders an empty control that still takes
 * focus.
 *
 * These are for the PREVIEW. The spec carries the icon's NAME and leaves an
 * icon-sized frame for the customer's own component — baking these paths in
 * would put this library's icon set into every file that imports the add-on.
 */
import SearchIcon from '@mui/icons-material/Search';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SettingsIcon from '@mui/icons-material/Settings';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import HomeIcon from '@mui/icons-material/Home';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import type { NavIcon } from '../utils/addOns/navContent';

const GLYPHS: Record<string, typeof SearchIcon> = {
  search: SearchIcon,
  menu: MenuIcon,
  close: CloseIcon,
  notifications: NotificationsIcon,
  settings: SettingsIcon,
  account: AccountCircleIcon,
  home: HomeIcon,
  add: AddIcon,
  more: MoreVertIcon,
  'chevron-down': ExpandMoreIcon,
  help: HelpOutlineIcon,
  cart: ShoppingCartIcon,
};

export default function NavIconGlyph({ name, fontSize = 'small' }: { name: NavIcon | string; fontSize?: 'small' | 'medium' }) {
  const Glyph = GLYPHS[name];
  if (!Glyph) return null;
  /* aria-hidden: the control around it owns the name. Both labelled and a
     screen reader announces it twice — "Search, Search button". */
  return <Glyph fontSize={fontSize} aria-hidden />;
}
