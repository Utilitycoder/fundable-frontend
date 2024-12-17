"use client";

import { FC } from "react";
// import { ConnectWallet } from "@/component_/ConnectWallet";
import { usePathname } from "next/navigation";

import { Button } from "../ui/button";
import ConnectWallet from "./ConnectWallet";
import Link from "next/link";

interface ButtonProps {
  onClick?: () => void;
  className?: string;
}

const ConnectWalletButton: FC<ButtonProps> = ({
  onClick,
  className,
  ...rest
}) => {
  const pathname = usePathname();
  const isRootPath = pathname === "/";

  return (
    <>
      {isRootPath ? (
        <Link href="/distribute">
          <Button
            onClick={onClick}
            variant="gradient"
            className={className}
            {...rest}
          >
            Launch App
          </Button>
        </Link>
      ) : (
        <ConnectWallet />
      )}
    </>
  );
};

export default ConnectWalletButton;
