import type { SVGProps } from "react";

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M17.3142 16.3142C16.4719 17.1566 15.1121 17.1566 14.2698 16.3142L12 14.0444L9.73017 16.3142C8.88785 17.1566 7.52814 17.1566 6.68581 16.3142C5.84349 15.4719 5.84349 14.1121 6.68581 13.2698L9.76777 10.1878C11.1819 8.77358 12.8181 8.77358 14.2322 10.1878L17.3142 13.2698C18.1565 14.1121 18.1565 15.4719 17.3142 16.3142Z"
        fill="currentColor"
      />
      <path
        d="M12 3C10.2217 3 8.45523 3.67341 7.15372 4.97492C5.06569 7.06295 4.5 10.4371 4.5 12C4.5 14.5833 6.41667 18.5 12 21C17.5833 18.5 19.5 14.5833 19.5 12C19.5 10.4371 18.9343 7.06295 16.8463 4.97492C15.5448 3.67341 13.7783 3 12 3Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M16 4.5C16 4.5 15 2 12 2C9 2 8 4.5 8 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
