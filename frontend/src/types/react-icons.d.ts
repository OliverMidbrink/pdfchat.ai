import * as React from 'react';

// Define the IconType used by react-icons
declare module 'react-icons' {
  export interface IconBaseProps extends React.SVGAttributes<SVGElement> {
    size?: string | number;
    color?: string;
    title?: string;
  }

  export type IconType = React.ComponentType<IconBaseProps>;
}

// Now declare all the icon exports from react-icons/fi
declare module 'react-icons/fi' {
  import { IconType } from 'react-icons';
  
  export const FiPlus: IconType;
  export const FiMenu: IconType;
  export const FiX: IconType;
  export const FiTrash2: IconType;
  export const FiUser: IconType;
  export const FiZap: IconType;
  export const FiSend: IconType;
  export const FiSettings: IconType;
  export const FiKey: IconType;
  export const FiLogOut: IconType;
  export const FiChevronLeft: IconType;
  export const FiChevronRight: IconType;
  export const FiFile: IconType;
  export const FiUpload: IconType;
  export const FiCheck: IconType;
  export const FiEdit2: IconType;
}
