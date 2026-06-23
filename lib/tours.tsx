import type { OnbordaProps } from 'onborda'

// onborda doesn't re-export its `Tour` type from the package root; derive it
// from the exported OnbordaProps (steps is Tour[]).
type Tour = OnbordaProps['steps'][number]

export const tours: Tour[] = [
  // ── Admin Tour ──────────────────────────────────────────────
  {
    tour: 'admin',
    steps: [
      {
        icon: '👋',
        title: 'Welcome, Admin!',
        content: (
          <p>
            This quick tour walks you through the DOTCOM dashboard.
            You can skip anytime or replay later from the <strong>?</strong> button.
          </p>
        ),
        selector: '#onb-admin-header',
        side: 'bottom',
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 12,
      },
      {
        icon: '🚌',
        title: 'Off-Bus Counter',
        content: (
          <p>
            Live count of members currently <strong>off the bus</strong>. Updates in real-time — no refresh needed.
          </p>
        ),
        selector: '#onb-counter',
        side: 'bottom',
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 12,
      },
      {
        icon: '🔍',
        title: 'Search & Filter',
        content: (
          <p>
            Search by name or NIM, filter by status, bus, or group — all at once.
            Results update instantly as you type.
          </p>
        ),
        selector: '#onb-filters',
        side: 'bottom',
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 12,
      },
      {
        icon: '📋',
        title: 'Member Table',
        content: (
          <p>
            Full roster with sortable columns. Click any member&apos;s name to edit
            their info. Use the toggle button to flip their bus status manually.
          </p>
        ),
        selector: '#onb-table',
        side: 'top',
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 12,
      },
      {
        icon: '📤',
        title: 'Export',
        content: (
          <p>
            Export the current filtered view as <strong>CSV</strong> or <strong>Excel</strong> —
            useful for attendance records after each stop.
          </p>
        ),
        selector: '#onb-export',
        side: 'bottom',
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 12,
      },
      {
        icon: '➕',
        title: 'Add Member',
        content: (
          <p>
            Click here to manually add a new member — fill in their name, NIM,
            group, bus, seat, room, and phone number.
          </p>
        ),
        selector: '#onb-add-member',
        side: 'bottom',
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 12,
      },
      {
        icon: '📷',
        title: 'QR Scanner',
        content: (
          <p>
            Scan a member&apos;s QR code to instantly toggle their bus status.
            Great for boarding checks — no tapping required.
          </p>
        ),
        selector: '#onb-scan-nav',
        side: 'bottom',
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 12,
        nextRoute: '/dashboard/scan',
      },
      {
        icon: '📸',
        title: 'Camera View',
        content: (
          <p>
            Point the camera at a member&apos;s QR code. Status flips immediately
            with haptic feedback on mobile.
          </p>
        ),
        selector: '#onb-scanner',
        side: 'bottom',
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 12,
        nextRoute: '/groups',
      },
      {
        icon: '👥',
        title: 'Groups',
        content: (
          <p>
            Browse members organized by their group. Useful for checking
            who&apos;s present per team or bus group.
          </p>
        ),
        selector: '#onb-groups',
        side: 'bottom',
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 12,
        nextRoute: '/rooms',
      },
      {
        icon: '🏨',
        title: 'Rooms',
        content: (
          <p>
            See which hotel room each member is in. Admins can assign and
            reassign members to rooms here.
          </p>
        ),
        selector: '#onb-rooms',
        side: 'bottom',
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 12,
        nextRoute: '/map',
      },
      {
        icon: '🗺️',
        title: 'Live Map',
        content: (
          <p>
            Members sharing their location show up as live pins. Committee can drop
            their own pins too — meeting points, rest stops, hazards.
          </p>
        ),
        selector: '#onb-map',
        side: 'bottom',
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 12,
      },
      {
        icon: '➕',
        title: 'Add a pin',
        content: (
          <p>
            Tap <strong>+</strong> to drop a pin — try it now. You can tap the map
            or paste a <strong>Google Maps link</strong>, pick an icon, and choose
            <strong> public</strong> (everyone) or <strong>private</strong> (committee only).
          </p>
        ),
        selector: '#onb-add-pin',
        side: 'right',
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 12,
      },
      {
        icon: '📏',
        title: 'Measure, route & filter',
        content: (
          <p>
            Tap the <strong>ruler</strong> to measure between any two points or pins,
            then <strong>Route by road</strong> for driving distance and ETA. The
            <strong> filter</strong> controls what shows — places, pins, members, labels.
          </p>
        ),
        selector: '#onb-map-tools',
        side: 'right',
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 12,
        nextRoute: '/dashboard',
      },
      {
        icon: '🎉',
        title: "You're all set!",
        content: (
          <p>
            That covers everything. Hit <strong>Done!</strong> to get started.
            You can replay this tour anytime from the <strong>?</strong> button in the nav.
          </p>
        ),
        selector: '#onb-admin-header',
        side: 'bottom',
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 12,
      },
    ],
  },

  // ── Member Tour ─────────────────────────────────────────────
  {
    tour: 'member',
    steps: [
      {
        icon: '👋',
        title: 'Welcome!',
        content: (
          <p>
            Quick tour of the DOTCOM app. This is your personal page —
            everything you need in one place.
          </p>
        ),
        selector: '#onb-member-header',
        side: 'bottom',
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 12,
      },
      {
        icon: '🟢',
        title: 'Your Status',
        content: (
          <p>
            Shows whether you&apos;re currently <strong>on</strong> or <strong>off</strong> the bus.
            This gets updated by the committee when they scan your QR code.
          </p>
        ),
        selector: '#onb-status',
        side: 'bottom',
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 12,
      },
      {
        icon: '📱',
        title: 'Your QR Code',
        content: (
          <p>
            Show this QR code to the committee at boarding. They scan it to
            mark you on or off the bus — no paper needed!
          </p>
        ),
        selector: '#onb-qr',
        side: 'top',
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 12,
      },
      {
        icon: '📍',
        title: 'Location Sharing',
        content: (
          <p>
            Toggle this to share your live location on the group map.
            Only visible to others in the trip — off by default.
          </p>
        ),
        selector: '#onb-location-toggle',
        side: 'top',
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 12,
        nextRoute: '/buses',
      },
      {
        icon: '🚌',
        title: 'Bus Seat Map',
        content: (
          <p>
            See the seating layout for your bus. Green = on bus, Red = off bus.
            Your seat is highlighted.
          </p>
        ),
        selector: '#onb-bus-map',
        side: 'top',
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 12,
        nextRoute: '/groups',
      },
      {
        icon: '👥',
        title: 'Groups',
        content: (
          <p>
            See all members organized by group. Check who&apos;s in your team
            and their current bus status.
          </p>
        ),
        selector: '#onb-groups',
        side: 'bottom',
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 12,
        nextRoute: '/rooms',
      },
      {
        icon: '🏨',
        title: 'Rooms',
        content: (
          <p>
            View your hotel room assignment and see who you&apos;re sharing with.
          </p>
        ),
        selector: '#onb-rooms',
        side: 'bottom',
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 12,
        nextRoute: '/map',
      },
      {
        icon: '🗺️',
        title: 'Live Map',
        content: (
          <p>
            See trip members in real-time (those sharing location), plus committee
            pins like meeting points and rest stops.
          </p>
        ),
        selector: '#onb-map',
        side: 'bottom',
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 12,
      },
      {
        icon: '📏',
        title: 'Measure & filter',
        content: (
          <p>
            Tap the <strong>ruler</strong> to measure distance between two points or
            pins — add <strong>Route by road</strong> for driving distance and ETA.
            Use the <strong>filter</strong> to choose what shows on the map.
          </p>
        ),
        selector: '#onb-map-tools',
        side: 'bottom',
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 12,
        nextRoute: '/me',
      },

      {
        icon: '🎉',
        title: "You're good to go!",
        content: (
          <p>
            That&apos;s everything! Hit <strong>Done!</strong> to start.
            You can replay this tour anytime from the <strong>?</strong> button.
          </p>
        ),
        selector: '#onb-member-header',
        side: 'bottom',
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 12,
      },
    ],
  },
]
