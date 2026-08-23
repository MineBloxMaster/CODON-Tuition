/*
 * ================================================================
 * CODON BOOKING SYSTEM
 * ================================================================
 *
 * Features:
 *
 * - Saturday + Sunday availability
 * - 10:00–19:00 availability window
 * - 15-minute consultations
 * - 30-minute booking intervals
 * - Google Calendar conflict checking
 * - Past-slot protection
 * - Website availability endpoint
 * - Website booking endpoint
 * - Booking lookup
 * - Booking cancellation
 * - Booking rescheduling
 * - Google Calendar event creation
 * - Customer confirmation emails
 * - CODON notification emails
 * - Reschedule emails
 * - Cancellation emails
 * - Double-booking protection
 */


/*
 * ================================================================
 * CONFIGURATION
 * ================================================================
 */


/*
 * CODON email address.
 */

const OWNER_EMAIL =
  "codon.tuition@gmail.com";


/*
 * CODON website.
 */

const WEBSITE_URL =
  "https://codontuition.co.uk";


/*
 * Main booking page.
 */

const BOOKING_URL =
  `${WEBSITE_URL}/booking.html`;


/*
 * Booking management page.
 */

const MANAGEMENT_URL =
  `${WEBSITE_URL}/booking-management.html`;


/*
 * UK timezone.
 */

const TIMEZONE =
  "Europe/London";


/*
 * Length of each consultation.
 */

const CONSULTATION_MINUTES =
  15;


/*
 * Time between available booking starts.
 *
 * Example:
 *
 * 10:00
 * 10:30
 * 11:00
 * 11:30
 * etc.
 */

const SLOT_INTERVAL_MINUTES =
  30;


/*
 * Google Calendar.
 *
 * "primary" means the primary calendar belonging
 * to the Google account running this script.
 */

const CALENDAR_ID =
  "primary";


/*
 * ================================================================
 * BOOKING DATABASE
 * ================================================================
 *
 * Google Sheet used to store bookings.
 *
 * Columns:
 *
 * A = Booking ID
 * B = Name
 * C = Email
 * D = Role
 * E = Subject
 * F = Message
 * G = Date
 * H = Time
 * I = Calendar Event ID
 * J = Status
 * K = Created At
 */

const BOOKING_SHEET_ID =
  "1OwAboiu-68ygdg8Re_c2veQ3SgCIW04lKTnekKIErrg";


const BOOKING_SHEET_NAME =
  "Bookings";


/*
 * ================================================================
 * WEEKLY AVAILABILITY
 * ================================================================
 *
 * JavaScript day numbers:
 *
 * 0 = Sunday
 * 1 = Monday
 * 2 = Tuesday
 * 3 = Wednesday
 * 4 = Thursday
 * 5 = Friday
 * 6 = Saturday
 */

const WEEKLY_AVAILABILITY = {

  0: {
    enabled: true,
    start: "10:00",
    end: "19:00"
  },

  1: {
    enabled: false
  },

  2: {
    enabled: false
  },

  3: {
    enabled: false
  },

  4: {
    enabled: false
  },

  5: {
    enabled: false
  },

  6: {
    enabled: true,
    start: "10:00",
    end: "19:00"
  }

};


/*
 * ================================================================
 * GET AVAILABLE SLOTS
 * ================================================================
 */

function getAvailableSlots(
  dateString
) {

  /*
   * Validate date.
   */

  if (!isValidDateString(dateString)) {

    return {

      success: false,

      message:
        "Invalid date."

    };

  }


  /*
   * Convert date string into Date object.
   */

  const date =
    parseDate(
      dateString
    );


  /*
   * Get day of week.
   */

  const dayOfWeek =
    date.getDay();


  /*
   * Get availability rules.
   */

  const availability =
    WEEKLY_AVAILABILITY[
      dayOfWeek
    ];


  /*
   * Day isn't available.
   */

  if (
    !availability ||
    !availability.enabled
  ) {

    return {

      success: true,

      date:
        dateString,

      slots:
        []

    };

  }


  /*
   * Generate possible slots.
   */

  const possibleSlots =
    generateSlots(
      date,
      availability.start,
      availability.end
    );


  /*
   * Get Calendar.
   */

  const calendar =
    CalendarApp.getCalendarById(
      CALENDAR_ID
    );


  if (!calendar) {

    throw new Error(
      "Google Calendar could not be found."
    );

  }


  /*
   * Get the beginning and end of the day.
   */

  const dayStart =
    new Date(date);

  dayStart.setHours(
    0,
    0,
    0,
    0
  );


  const dayEnd =
    new Date(date);

  dayEnd.setHours(
    23,
    59,
    59,
    999
  );


  /*
   * Get Calendar events for this day.
   */

  const events =
    calendar.getEvents(
      dayStart,
      dayEnd
    );


  /*
   * Remove past slots and conflicts.
   */

  const availableSlots =
    possibleSlots.filter(
      slot => {

        /*
         * Past-slot protection.
         */

        if (
          slot.start.getTime() <=
          Date.now()
        ) {

          return false;

        }


        /*
         * Check Calendar conflicts.
         */

        const conflict =
          events.some(
            event =>
              event.getStartTime() <
                slot.end &&
              event.getEndTime() >
                slot.start
          );


        return !conflict;

      }
    );


  /*
   * Return clean data for the website.
   */

  return {

    success: true,

    date:
      dateString,

    slots:
      availableSlots.map(
        slot => {

          return {

            time:
              Utilities.formatDate(
                slot.start,
                TIMEZONE,
                "HH:mm"
              ),

            start:
              slot.start.toISOString(),

            end:
              slot.end.toISOString()

          };

        }
      )

  };

}


/*
 * ================================================================
 * GENERATE POSSIBLE SLOTS
 * ================================================================
 */

function generateSlots(
  date,
  startTime,
  endTime
) {

  const slots = [];


  const startMinutes =
    timeToMinutes(
      startTime
    );


  const endMinutes =
    timeToMinutes(
      endTime
    );


  /*
   * Generate slots at the configured interval.
   *
   * The consultation must finish by endTime.
   */

  for (
    let minutes = startMinutes;

    minutes +
      CONSULTATION_MINUTES <=
      endMinutes;

    minutes +=
      SLOT_INTERVAL_MINUTES
  ) {

    const start =
      new Date(date);


    start.setHours(
      Math.floor(
        minutes / 60
      ),
      minutes % 60,
      0,
      0
    );


    const end =
      new Date(
        start.getTime() +
        CONSULTATION_MINUTES *
        60 *
        1000
      );


    slots.push({

      start:
        start,

      end:
        end

    });

  }


  return slots;

}


/*
 * ================================================================
 * CHECK SINGLE SLOT
 * ================================================================
 */

function isSlotAvailable(
  dateString,
  timeString
) {

  /*
   * Validate inputs.
   */

  if (
    !isValidDateString(
      dateString
    ) ||
    !isValidTimeString(
      timeString
    )
  ) {

    return false;

  }


  /*
   * Parse date.
   */

  const date =
    parseDate(
      dateString
    );


  /*
   * Get availability rules.
   */

  const availability =
    WEEKLY_AVAILABILITY[
      date.getDay()
    ];


  if (
    !availability ||
    !availability.enabled
  ) {

    return false;

  }


  /*
   * Generate valid slots.
   */

  const possibleSlots =
    generateSlots(
      date,
      availability.start,
      availability.end
    );


  /*
   * Find requested slot.
   */

  const requestedSlot =
    possibleSlots.find(
      slot =>
        Utilities.formatDate(
          slot.start,
          TIMEZONE,
          "HH:mm"
        ) ===
        timeString
    );


  if (!requestedSlot) {

    return false;

  }


  /*
   * Don't allow past bookings.
   */

  if (
    requestedSlot.start.getTime() <=
    Date.now()
  ) {

    return false;

  }


  /*
   * Get Calendar.
   */

  const calendar =
    CalendarApp.getCalendarById(
      CALENDAR_ID
    );


  if (!calendar) {

    throw new Error(
      "Google Calendar could not be found."
    );

  }


  /*
   * Get overlapping events.
   */

  const events =
    calendar.getEvents(
      requestedSlot.start,
      requestedSlot.end
    );


  /*
   * Check for an actual overlap.
   */

  const conflict =
    events.some(
      event =>
        event.getStartTime() <
          requestedSlot.end &&
        event.getEndTime() >
          requestedSlot.start
    );


  return !conflict;

}


/*
 * ================================================================
 * FIND REQUESTED SLOT
 * ================================================================
 */

function getRequestedSlot(
  dateString,
  timeString
) {

  if (
    !isValidDateString(
      dateString
    ) ||
    !isValidTimeString(
      timeString
    )
  ) {

    return null;

  }


  const date =
    parseDate(
      dateString
    );


  const availability =
    WEEKLY_AVAILABILITY[
      date.getDay()
    ];


  if (
    !availability ||
    !availability.enabled
  ) {

    return null;

  }


  const possibleSlots =
    generateSlots(
      date,
      availability.start,
      availability.end
    );


  return (
    possibleSlots.find(
      slot =>
        Utilities.formatDate(
          slot.start,
          TIMEZONE,
          "HH:mm"
        ) ===
        timeString
    ) ||
    null
  );

}


/*
 * ================================================================
 * CREATE CALENDAR EVENT
 * ================================================================
 */

function createBookingEvent(
  booking
) {

  const calendar =
    CalendarApp.getCalendarById(
      CALENDAR_ID
    );


  if (!calendar) {

    throw new Error(
      "Google Calendar could not be found."
    );

  }


  /*
   * Find requested slot.
   */

  const slot =
    getRequestedSlot(
      booking.date,
      booking.time
    );


  if (!slot) {

    throw new Error(
      "Invalid booking time."
    );

  }


  /*
   * Event title.
   */

  const title =
    `CODON Consultation — ${booking.name}`;


  /*
   * Event description.
   */

  const description =

    `CODON free 15-minute consultation\n\n` +

    `Name: ${booking.name}\n` +

    `Email: ${booking.email}\n` +

    `Role: ${booking.role}\n` +

    `Subject: ${booking.subject}\n\n` +

    `Additional information:\n` +

    `${booking.message || "None provided"}`;


  /*
   * Create Calendar event.
   */

  const event =
    calendar.createEvent(
      title,
      slot.start,
      slot.end,
      {
        description:
          description,

        guests:
          booking.email,

        sendInvites:
          false

      }
    );


  return {

    event:
      event,

    slot:
      slot

  };

}


/*
 * ================================================================
 * BOOKING DATABASE
 * ================================================================
 */


/*
 * Get booking sheet.
 */

function getBookingSheet() {

  const spreadsheet =
    SpreadsheetApp.openById(
      BOOKING_SHEET_ID
    );


  const sheet =
    spreadsheet.getSheetByName(
      BOOKING_SHEET_NAME
    );


  if (!sheet) {

    throw new Error(
      `Booking sheet "${BOOKING_SHEET_NAME}" could not be found.`
    );

  }


  return sheet;

}


/*
 * ================================================================
 * NORMALISE EMAIL
 * ================================================================
 */

function normaliseEmail(
  email
) {

  return String(
    email
  )
    .trim()
    .toLowerCase();

}


/*
 * ================================================================
 * NORMALISE SUBJECT
 * ================================================================
 */

function normaliseSubject(
  subject
) {

  return String(
    subject
  )
    .trim()
    .toLowerCase();

}


/*
 * ================================================================
 * GENERATE UNIQUE BOOKING ID
 * ================================================================
 */

function generateBookingId() {

  const sheet =
    getBookingSheet();


  const lastRow =
    sheet.getLastRow();


  const existingIds =
    lastRow < 2

      ? []

      : sheet
          .getRange(
            2,
            1,
            lastRow - 1,
            1
          )
          .getValues()
          .flat()
          .map(
            id =>
              String(id)
                .trim()
                .toUpperCase()
          );


  let bookingId;


  do {

    const randomPart =
      Utilities
        .getUuid()
        .replace(
          /-/g,
          ""
        )
        .substring(
          0,
          6
        )
        .toUpperCase();


    bookingId =
      `CODON-${randomPart}`;


  } while (
    existingIds.includes(
      bookingId
    )
  );


  return bookingId;

}


/*
 * ================================================================
 * CHECK EXISTING BOOKING
 * ================================================================
 */

function hasExistingBooking(
  email,
  subject
) {

  const sheet =
    getBookingSheet();


  const lastRow =
    sheet.getLastRow();


  if (
    lastRow < 2
  ) {

    return false;

  }


  const rows =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        11
      )
      .getValues();


  const targetEmail =
    normaliseEmail(
      email
    );


  const targetSubject =
    normaliseSubject(
      subject
    );


  return rows.some(
    row => {

      const existingEmail =
        normaliseEmail(
          row[2]
        );


      const existingSubject =
        normaliseSubject(
          row[4]
        );


      const status =
        String(
          row[9] || ""
        )
          .trim()
          .toLowerCase();


      if (
        status === "cancelled"
      ) {

        return false;

      }


      return (
        existingEmail ===
          targetEmail &&
        existingSubject ===
          targetSubject
      );

    }
  );

}


/*
 * ================================================================
 * FIND BOOKING BY ID
 * ================================================================
 */

function getBookingById(
  bookingId
) {

  const sheet =
    getBookingSheet();


  const lastRow =
    sheet.getLastRow();


  if (
    lastRow < 2
  ) {

    return null;

  }


  const rows =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        11
      )
      .getValues();


  const targetId =
    String(
      bookingId
    )
      .trim()
      .toUpperCase();


  const row =
    rows.find(
      row =>
        String(
          row[0]
        )
          .trim()
          .toUpperCase() ===
        targetId
    );


  if (!row) {

    return null;

  }


  return {

    id:
      String(
        row[0]
      ),

    name:
      String(
        row[1]
      ),

    email:
      String(
        row[2]
      ),

    role:
      String(
        row[3]
      ),

    subject:
      String(
        row[4]
      ),

    message:
      String(
        row[5]
      ),

    date:
      formatSheetDate(
        row[6]
      ),

    time:
      formatSheetTime(
        row[7]
      ),

    calendarEventId:
      String(
        row[8]
      ),

    status:
      String(
        row[9]
      ),

    createdAt:
      row[10]

  };

}


/*
 * ================================================================
 * SAVE BOOKING
 * ================================================================
 */

function saveBooking(
  booking,
  bookingResult
) {

  const sheet =
    getBookingSheet();


  const bookingId =
    generateBookingId();


  const createdAt =
    new Date();


  sheet.appendRow([

    bookingId,

    booking.name,

    normaliseEmail(
      booking.email
    ),

    booking.role,

    booking.subject,

    booking.message || "",

    booking.date,

    booking.time,

    bookingResult.event.getId(),

    "Confirmed",

    createdAt

  ]);


  return bookingId;

}


/*
 * ================================================================
 * CANCEL BOOKING
 * ================================================================
 */

function cancelBooking(
  bookingId
) {

  if (
    !bookingId ||
    String(
      bookingId
    ).trim() === ""
  ) {

    return {

      success: false,

      message:
        "Please provide a booking ID."

    };

  }


  const booking =
    getBookingById(
      bookingId
    );


  if (!booking) {

    return {

      success: false,

      message:
        "Booking not found."

    };

  }


  if (
    String(
      booking.status
    )
      .trim()
      .toLowerCase() ===
      "cancelled"
  ) {

    return {

      success: false,

      message:
        "This booking has already been cancelled."

    };

  }


  /*
   * Get Calendar.
   */

  const calendar =
    CalendarApp.getCalendarById(
      CALENDAR_ID
    );


  if (!calendar) {

    throw new Error(
      "Google Calendar could not be found."
    );

  }


  /*
   * Delete Calendar event if it exists.
   */

  const event =
    calendar.getEventById(
      booking.calendarEventId
    );


  if (event) {

    event.deleteEvent();

  }


  /*
   * Find booking row.
   */

  const sheet =
    getBookingSheet();


  const lastRow =
    sheet.getLastRow();


  const rows =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        11
      )
      .getValues();


  const rowIndex =
    rows.findIndex(
      row =>
        String(
          row[0]
        )
          .trim()
          .toUpperCase() ===
        String(
          bookingId
        )
          .trim()
          .toUpperCase()
    );


  if (
    rowIndex === -1
  ) {

    throw new Error(
      "Booking could not be located in the database."
    );

  }


  const sheetRow =
    rowIndex + 2;


  /*
   * Column J = Status.
   */

  sheet
    .getRange(
      sheetRow,
      10
    )
    .setValue(
      "Cancelled"
    );


  /*
   * Format original appointment.
   */

  const dateFormatted =
    formatDateForEmail(
      booking.date
    );


  const timeFormatted =
    booking.time;


  /*
   * Send cancellation emails.
   */

  sendCancellationEmails(
    booking,
    dateFormatted,
    timeFormatted
  );


  return {

    success: true,

    booking: {

      id:
        booking.id,

      status:
        "Cancelled"

    }

  };

}


/*
 * ================================================================
 * RESCHEDULE BOOKING
 * ================================================================
 */

function rescheduleBooking(
  bookingId,
  newDate,
  newTime
) {

  /*
   * Validate inputs.
   */

  if (
    !bookingId ||
    String(
      bookingId
    ).trim() === "" ||
    !newDate ||
    String(
      newDate
    ).trim() === "" ||
    !newTime ||
    String(
      newTime
    ).trim() === ""
  ) {

    return {

      success: false,

      message:
        "Booking ID, date and time are required."

    };

  }


  /*
   * Get existing booking.
   */

  const booking =
    getBookingById(
      bookingId
    );


  if (!booking) {

    return {

      success: false,

      message:
        "Booking not found."

    };

  }


  /*
   * Cancelled bookings cannot be rescheduled.
   */

  if (
    String(
      booking.status
    )
      .trim()
      .toLowerCase() ===
      "cancelled"
  ) {

    return {

      success: false,

      message:
        "Cancelled bookings cannot be rescheduled."

    };

  }


  /*
   * Prevent same-slot rescheduling.
   */

  if (
    booking.date ===
      newDate &&
    booking.time ===
      newTime
  ) {

    return {

      success: false,

      message:
        "Please choose a different date or time."

    };

  }


  /*
   * Validate new slot.
   */

  const newSlot =
    getRequestedSlot(
      newDate,
      newTime
    );


  if (!newSlot) {

    return {

      success: false,

      message:
        "The new date or time is invalid."

    };

  }


  /*
   * Check availability.
   */

  if (
    !isSlotAvailable(
      newDate,
      newTime
    )
  ) {

    return {

      success: false,

      message:
        "That time is no longer available. Please choose another slot."

    };

  }


  /*
   * Get Calendar.
   */

  const calendar =
    CalendarApp.getCalendarById(
      CALENDAR_ID
    );


  if (!calendar) {

    throw new Error(
      "Google Calendar could not be found."
    );

  }


  /*
   * Find existing event.
   */

  const event =
    calendar.getEventById(
      booking.calendarEventId
    );


  if (!event) {

    return {

      success: false,

      message:
        "The Calendar event for this booking could not be found."

    };

  }


  /*
   * IMPORTANT:
   *
   * Save the old appointment BEFORE
   * changing anything.
   */

  const oldDate =
    booking.date;


  const oldTime =
    booking.time;


  /*
   * Move Calendar event.
   */

  event.setTime(
    newSlot.start,
    newSlot.end
  );


  /*
   * Find booking row.
   */

  const sheet =
    getBookingSheet();


  const lastRow =
    sheet.getLastRow();


  const rows =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        11
      )
      .getValues();


  const rowIndex =
    rows.findIndex(
      row =>
        String(
          row[0]
        )
          .trim()
          .toUpperCase() ===
        String(
          bookingId
        )
          .trim()
          .toUpperCase()
    );


  if (
    rowIndex === -1
  ) {

    /*
     * Try to avoid leaving Calendar and
     * Sheet out of sync.
     */

    event.setTime(
      parseDateTime(
        oldDate,
        oldTime
      ),
      new Date(
        parseDateTime(
          oldDate,
          oldTime
        ).getTime() +
        CONSULTATION_MINUTES *
        60 *
        1000
      )
    );


    throw new Error(
      "Booking could not be located in the database."
    );

  }


  const sheetRow =
    rowIndex + 2;


  /*
   * Column G = Date.
   */

  sheet
    .getRange(
      sheetRow,
      7
    )
    .setValue(
      newDate
    );


  /*
   * Column H = Time.
   */

  sheet
    .getRange(
      sheetRow,
      8
    )
    .setValue(
      newTime
    );


  /*
   * Format dates for email.
   */

  const oldDateFormatted =
    formatDateForEmail(
      oldDate
    );


  const oldTimeFormatted =
    oldTime;


  const newDateFormatted =
    formatDateForEmail(
      newDate
    );


  const newTimeFormatted =
    newTime;


  /*
   * Send reschedule emails.
   */

  sendRescheduleEmails(
    booking,
    oldDateFormatted,
    oldTimeFormatted,
    newDateFormatted,
    newTimeFormatted
  );


  return {

    success: true,

    booking: {

      id:
        booking.id,

      name:
        booking.name,

      subject:
        booking.subject,

      date:
        newDate,

      time:
        newTime,

      status:
        booking.status

    }

  };

}


/*
 * ================================================================
 * PUBLIC BOOKING LOOKUP
 * ================================================================
 */

function getPublicBookingById(
  bookingId
) {

  if (
    !bookingId ||
    String(
      bookingId
    ).trim() === ""
  ) {

    return {

      success: false,

      message:
        "Please provide a booking ID."

    };

  }


  const booking =
    getBookingById(
      bookingId
    );


  /*
   * Check existence BEFORE accessing
   * any booking properties.
   */

  if (!booking) {

    return {

      success: false,

      message:
        "Booking not found."

    };

  }


  /*
   * Return only customer-safe information.
   */

  return {

    success: true,

    booking: {

      id:
        booking.id,

      name:
        booking.name,

      role:
        booking.role,

      subject:
        booking.subject,

      date:
        booking.date,

      time:
        booking.time,

      status:
        booking.status

    }

  };

}


/*
 * ================================================================
 * PUBLIC RESCHEDULE
 * ================================================================
 */

function reschedulePublicBooking(
  bookingId,
  newDate,
  newTime
) {

  const result =
    rescheduleBooking(
      bookingId,
      newDate,
      newTime
    );


  if (!result.success) {

    return result;

  }


  return {

    success: true,

    booking: {

      id:
        result.booking.id,

      name:
        result.booking.name,

      subject:
        result.booking.subject,

      date:
        result.booking.date,

      time:
        result.booking.time,

      status:
        result.booking.status

    }

  };

}


/*
 * ================================================================
 * PUBLIC CANCELLATION
 * ================================================================
 */

function cancelPublicBooking(
  bookingId
) {

  const result =
    cancelBooking(
      bookingId
    );


  if (!result.success) {

    return result;

  }


  return {

    success: true,

    booking: {

      id:
        result.booking.id,

      status:
        result.booking.status

    }

  };

}


/*
 * ================================================================
 * PUBLIC GET ENDPOINT
 * ================================================================
 */

function doGet(e) {

  try {

    if (
      !e ||
      !e.parameter
    ) {

      return jsonResponse({

        success: false,

        message:
          "No request parameters were provided."

      });

    }

    /*
     * ============================================================
     * ADMIN BOOKING LOOKUP
     * ============================================================
     */

    if (
      e.parameter.action ===
      "adminBookings"
    ) {

      return jsonResponse(
        getAdminBookings(
          e.parameter.CODON_ADMIN_SECRET
        )
      );

    }

    /*
     * Booking lookup.
     */

    if (
      e.parameter.bookingId
    ) {

      return jsonResponse(
        getPublicBookingById(
          e.parameter.bookingId
        )
      );

    }


    /*
     * Availability lookup.
     */

    if (
      e.parameter.date
    ) {

      return jsonResponse(
        getAvailableSlots(
          e.parameter.date
        )
      );

    }


    return jsonResponse({

      success: false,

      message:
        "Please provide a date or booking ID."

    });


  } catch (error) {

    console.error(
      error
    );


    return jsonResponse({

      success: false,

      message:
        "Unable to process your request."

    });

  }

}


/*
 * ================================================================
 * PUBLIC POST ENDPOINT
 * ================================================================
 */

function doPost(e) {

  /*
   * Lock the booking process.
   *
   * This prevents two people from booking
   * the same slot at exactly the same time.
   */

  const lock =
    LockService.getScriptLock();


  try {

    lock.waitLock(
      10000
    );


    /*
     * Validate request body.
     */

    if (
      !e ||
      !e.postData ||
      !e.postData.contents
    ) {

      return jsonResponse({

        success: false,

        message:
          "No booking information was received."

      });

    }


    /*
     * Parse JSON.
     */

    const request =
      JSON.parse(
        e.postData.contents
      );

    /*
     * ============================================================
     * ADMIN — CANCELLATION
     * ============================================================
     */

    if (
      request.action ===
      "adminCancel"
    ) {

      return jsonResponse(
        cancelAdminBooking(

          request.adminSecret,

          request.bookingId

        )
      );

    }


    /*
     * ============================================================
     * ADMIN — RESCHEDULE
     * ============================================================
     */

    if (
      request.action ===
      "adminReschedule"
    ) {

      return jsonResponse(
        rescheduleAdminBooking(

          request.adminSecret,

          request.bookingId,

          request.date,

          request.time

        )
      );

    }

    /*
     * ============================================================
     * CANCELLATION
     * ============================================================
     */

    if (
      request.action ===
      "cancel"
    ) {

      if (
        !request.bookingId
      ) {

        return jsonResponse({

          success: false,

          message:
            "No Booking ID was provided."

        });

      }


      return jsonResponse(
        cancelPublicBooking(
          String(
            request.bookingId
          )
            .trim()
            .toUpperCase()
        )
      );

    }


    /*
     * ============================================================
     * RESCHEDULE
     * ============================================================
     */

    if (
      request.action ===
      "reschedule"
    ) {

      if (
        !request.bookingId ||
        !request.date ||
        !request.time
      ) {

        return jsonResponse({

          success: false,

          message:
            "Booking ID, date and time are required."

        });

      }


      return jsonResponse(
        reschedulePublicBooking(

          String(
            request.bookingId
          )
            .trim()
            .toUpperCase(),

          String(
            request.date
          ).trim(),

          String(
            request.time
          ).trim()

        )
      );

    }


    /*
     * ============================================================
     * NORMAL BOOKING
     * ============================================================
     */

    const booking =
      request;


    /*
     * Required fields.
     */

    const requiredFields = [

      "name",
      "email",
      "role",
      "subject",
      "date",
      "time"

    ];


    const missingField =
      requiredFields.find(
        field =>
          !booking[field] ||
          String(
            booking[field]
          ).trim() === ""
      );


    if (missingField) {

      return jsonResponse({

        success: false,

        message:
          "Please complete all required fields."

      });

    }


    /*
     * Validate email.
     */

    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


    if (
      !emailPattern.test(
        String(
          booking.email
        ).trim()
      )
    ) {

      return jsonResponse({

        success: false,

        message:
          "Please provide a valid email address."

      });

    }


    /*
     * Validate date and time.
     */

    if (
      !isValidDateString(
        booking.date
      ) ||
      !isValidTimeString(
        booking.time
      )
    ) {

      return jsonResponse({

        success: false,

        message:
          "Please provide a valid date and time."

      });

    }


    /*
     * ============================================================
     * DUPLICATE CONSULTATION CHECK
     * ============================================================
     *
     * One free consultation per customer per subject.
     */

    if (
      hasExistingBooking(
        booking.email,
        booking.subject
      )
    ) {

      return jsonResponse({

        success: false,

        message:
          "You have already booked a free consultation for this subject. If you need to make changes to your existing consultation, please use your booking management link."

      });

    }


    /*
     * ============================================================
     * FINAL AVAILABILITY CHECK
     * ============================================================
     *
     * This must happen immediately before
     * creating the Calendar event.
     */

    if (
      !isSlotAvailable(
        booking.date,
        booking.time
      )
    ) {

      return jsonResponse({

        success: false,

        message:
          "That time is no longer available. Please choose another slot."

      });

    }


    /*
     * ============================================================
     * CREATE CALENDAR EVENT
     * ============================================================
     */

    const bookingResult =
      createBookingEvent(
        booking
      );


    /*
     * ============================================================
     * SAVE BOOKING
     * ============================================================
     */

    const bookingId =
      saveBooking(
        booking,
        bookingResult
      );


    /*
     * Format appointment for email.
     */

    const dateFormatted =
      Utilities.formatDate(
        bookingResult.slot.start,
        TIMEZONE,
        "EEEE d MMMM yyyy"
      );


    const timeFormatted =
      Utilities.formatDate(
        bookingResult.slot.start,
        TIMEZONE,
        "HH:mm"
      );


    /*
     * ============================================================
     * SEND NEW BOOKING EMAILS
     * ============================================================
     */

    sendNewBookingEmails(
      booking,
      bookingId,
      dateFormatted,
      timeFormatted
    );


    /*
     * ============================================================
     * SUCCESS
     * ============================================================
     */

    return jsonResponse({

      success: true,

      booking: {

        id:
          bookingId,

        date:
          booking.date,

        dateFormatted:
          dateFormatted,

        time:
          timeFormatted

      }

    });


  } catch (error) {

    console.error(
      error
    );


    return jsonResponse({

      success: false,

      message:
        "We couldn't complete the booking. Please try again."

    });


  } finally {

    try {

      lock.releaseLock();

    } catch (error) {

      console.error(
        error
      );

    }

  }

}


/*
 * ================================================================
 * EMAIL — NEW BOOKING
 * ================================================================
 */

function sendNewBookingEmails(
  booking,
  bookingId,
  dateFormatted,
  timeFormatted
) {

  /*
   * CUSTOMER EMAIL
   */

  const customerSubject =
    "Your CODON consultation is confirmed";


  const customerHtml =

    emailHeader(
      "Your consultation is confirmed"
    ) +

    `<p>Hi ${escapeHtml(booking.name)},</p>` +

    `<p>
      Your free 15-minute CODON consultation has been
      booked successfully.
    </p>` +

    emailDetails([
      ["Date", dateFormatted],
      ["Time", timeFormatted],
      ["Subject", booking.subject],
      ["Booking ID", bookingId]
    ]) +

    `<p>
      We'll speak with you online at the scheduled time.
    </p>` +

    emailButton(
      "Manage your booking",
      `${MANAGEMENT_URL}?bookingId=${encodeURIComponent(bookingId)}`
    ) +

    `<p>
      Keep your Booking ID safe. You'll need it if you
      want to reschedule or cancel your consultation.
    </p>` +

    emailFooter();


  MailApp.sendEmail({

    to:
      booking.email,

    subject:
      customerSubject,

    htmlBody:
      customerHtml

  });


  /*
   * ADMIN EMAIL
   */

  const ownerSubject =
    `New CODON consultation — ${booking.name}`;


  const ownerHtml =

    emailHeader(
      "New consultation booked"
    ) +

    `<p>
      A new CODON consultation has been booked.
    </p>` +

    emailDetails([
      ["Booking ID", bookingId],
      ["Name", booking.name],
      ["Email", booking.email],
      ["Role", booking.role],
      ["Subject", booking.subject],
      ["Date", dateFormatted],
      ["Time", timeFormatted]
    ]) +

    `<p>
      <strong>Additional information</strong>
    </p>` +

    `<p>
      ${escapeHtml(
        booking.message ||
        "None provided"
      )}
    </p>` +

    emailButton(
      "Open booking management",
      `${MANAGEMENT_URL}?bookingId=${encodeURIComponent(bookingId)}`
    ) +

    emailFooter();


  MailApp.sendEmail({

    to:
      OWNER_EMAIL,

    subject:
      ownerSubject,

    htmlBody:
      ownerHtml

  });

}


/*
 * ================================================================
 * EMAIL — RESCHEDULE
 * ================================================================
 */

function sendRescheduleEmails(
  booking,
  oldDateFormatted,
  oldTimeFormatted,
  newDateFormatted,
  newTimeFormatted
) {

  /*
   * CUSTOMER EMAIL
   */

  const customerSubject =
    "Your CODON consultation has been rescheduled";


  const customerHtml =

    emailHeader(
      "Your consultation has been rescheduled"
    ) +

    `<p>Hi ${escapeHtml(booking.name)},</p>` +

    `<p>
      Your CODON consultation has been successfully
      moved to a new date and time.
    </p>` +

    `<h3 style="margin:24px 0 10px;">
      Previous appointment
    </h3>` +

    emailDetails([
      ["Date", oldDateFormatted],
      ["Time", oldTimeFormatted]
    ]) +

    `<h3 style="margin:24px 0 10px;">
      New appointment
    </h3>` +

    emailDetails([
      ["Date", newDateFormatted],
      ["Time", newTimeFormatted],
      ["Booking ID", booking.id]
    ]) +

    `<p>
      Your previous time is no longer reserved.
    </p>` +

    emailButton(
      "Manage your booking",
      `${MANAGEMENT_URL}?bookingId=${encodeURIComponent(booking.id)}`
    ) +

    emailFooter();


  MailApp.sendEmail({

    to:
      booking.email,

    subject:
      customerSubject,

    htmlBody:
      customerHtml

  });


  /*
   * ADMIN EMAIL
   */

  const ownerSubject =
    `CODON consultation rescheduled — ${booking.name}`;


  const ownerHtml =

    emailHeader(
      "Consultation rescheduled"
    ) +

    `<p>
      A CODON consultation has been rescheduled.
    </p>` +

    emailDetails([
      ["Booking ID", booking.id],
      ["Name", booking.name],
      ["Email", booking.email],
      ["Role", booking.role],
      ["Subject", booking.subject]
    ]) +

    `<h3 style="margin:24px 0 10px;">
      Previous appointment
    </h3>` +

    emailDetails([
      ["Date", oldDateFormatted],
      ["Time", oldTimeFormatted]
    ]) +

    `<h3 style="margin:24px 0 10px;">
      New appointment
    </h3>` +

    emailDetails([
      ["Date", newDateFormatted],
      ["Time", newTimeFormatted]
    ]) +

    emailButton(
      "Open booking management",
      `${MANAGEMENT_URL}?bookingId=${encodeURIComponent(booking.id)}`
    ) +

    emailFooter();


  MailApp.sendEmail({

    to:
      OWNER_EMAIL,

    subject:
      ownerSubject,

    htmlBody:
      ownerHtml

  });

}


/*
 * ================================================================
 * EMAIL — CANCELLATION
 * ================================================================
 */

function sendCancellationEmails(
  booking,
  dateFormatted,
  timeFormatted
) {

  /*
   * CUSTOMER EMAIL
   */

  const customerSubject =
    "Your CODON consultation has been cancelled";


  const customerHtml =

    emailHeader(
      "Your consultation has been cancelled"
    ) +

    `<p>Hi ${escapeHtml(booking.name)},</p>` +

    `<p>
      Your CODON consultation has been cancelled successfully.
    </p>` +

    emailDetails([
      ["Date", dateFormatted],
      ["Time", timeFormatted],
      ["Subject", booking.subject],
      ["Booking ID", booking.id]
    ]) +

    `<p>
      Your previous consultation slot is no longer reserved.
    </p>` +

    emailButton(
      "Book another consultation",
      BOOKING_URL
    ) +

    emailFooter();


  MailApp.sendEmail({

    to:
      booking.email,

    subject:
      customerSubject,

    htmlBody:
      customerHtml

  });


  /*
   * ADMIN EMAIL
   */

  const ownerSubject =
    `CODON consultation cancelled — ${booking.name}`;


  const ownerHtml =

    emailHeader(
      "Consultation cancelled"
    ) +

    `<p>
      A CODON consultation has been cancelled.
    </p>` +

    emailDetails([
      ["Booking ID", booking.id],
      ["Name", booking.name],
      ["Email", booking.email],
      ["Role", booking.role],
      ["Subject", booking.subject],
      ["Date", dateFormatted],
      ["Time", timeFormatted]
    ]) +

    emailButton(
      "Open booking management",
      `${MANAGEMENT_URL}?bookingId=${encodeURIComponent(booking.id)}`
    ) +

    emailFooter();


  MailApp.sendEmail({

    to:
      OWNER_EMAIL,

    subject:
      ownerSubject,

    htmlBody:
      ownerHtml

  });

}


/*
 * ================================================================
 * EMAIL — HEADER
 * ================================================================
 */

function emailHeader(
  title
) {

  return `

    <div style="
      max-width:600px;
      margin:0 auto;
      font-family:Arial,Helvetica,sans-serif;
      color:#252823;
      background:#ffffff;
    ">

      <div style="
        padding:28px 30px;
        border-bottom:1px solid #e5e8e2;
      ">

        <div style="
          font-size:20px;
          font-weight:700;
          letter-spacing:2px;
        ">
          CODON
        </div>

      </div>


      <div style="
        padding:35px 30px;
      ">

        <h2 style="
          margin:0 0 20px;
          font-size:25px;
          line-height:1.25;
          color:#252823;
        ">
          ${escapeHtml(title)}
        </h2>

  `;

}


/*
 * ================================================================
 * EMAIL — FOOTER
 * ================================================================
 */

function emailFooter() {

  return `

      </div>


      <div style="
        padding:24px 30px;
        border-top:1px solid #e5e8e2;
        font-size:13px;
        line-height:1.6;
        color:#81877e;
      ">

        <strong style="color:#252823;">
          CODON
        </strong>
        · GCSE Maths & Science Tutoring

        <br><br>

        This is an automated email regarding your
        CODON consultation.

      </div>

    </div>

  `;

}


/*
 * ================================================================
 * EMAIL — DETAILS
 * ================================================================
 */

function emailDetails(
  details
) {

  let html = `

    <div style="
      margin:20px 0;
      border:1px solid #e5e8e2;
      border-radius:10px;
      overflow:hidden;
    ">
  `;


  details.forEach(
    ([label, value]) => {

      html += `

        <div style="
          padding:13px 16px;
          border-bottom:1px solid #e5e8e2;
        ">

          <div style="
            font-size:12px;
            color:#81877e;
            margin-bottom:4px;
          ">
            ${escapeHtml(label)}
          </div>

          <div style="
            font-size:15px;
            font-weight:600;
            color:#252823;
          ">
            ${escapeHtml(value)}
          </div>

        </div>

      `;

    }
  );


  html += `

    </div>

  `;


  return html;

}


/*
 * ================================================================
 * EMAIL — BUTTON
 * ================================================================
 */

function emailButton(
  text,
  url
) {

  return `

    <div style="
      margin:26px 0;
    ">

      <a
        href="${escapeHtml(url)}"
        style="
          display:inline-block;
          padding:13px 20px;
          background:#252823;
          color:#ffffff;
          text-decoration:none;
          border-radius:8px;
          font-size:14px;
          font-weight:600;
        "
      >
        ${escapeHtml(text)}
      </a>

    </div>

  `;

}


/*
 * ================================================================
 * HTML ESCAPING
 * ================================================================
 */

function escapeHtml(
  value
) {

  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}


/*
 * ================================================================
 * VALIDATE DATE
 * ================================================================
 */

function isValidDateString(
  dateString
) {

  if (
    typeof dateString !==
    "string"
  ) {

    return false;

  }


  /*
   * Require YYYY-MM-DD.
   */

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      dateString
    )
  ) {

    return false;

  }


  const date =
    parseDate(
      dateString
    );


  /*
   * Compare components to make
   * sure JavaScript didn't normalise
   * an invalid date.
   */

  const parts =
    dateString.split("-");


  return (
    date.getFullYear() ===
      Number(parts[0]) &&

    date.getMonth() ===
      Number(parts[1]) - 1 &&

    date.getDate() ===
      Number(parts[2])
  );

}


/*
 * ================================================================
 * VALIDATE TIME
 * ================================================================
 */

function isValidTimeString(
  timeString
) {

  if (
    typeof timeString !==
    "string"
  ) {

    return false;

  }


  if (
    !/^\d{2}:\d{2}$/.test(
      timeString
    )
  ) {

    return false;

  }


  const parts =
    timeString.split(":");


  const hours =
    Number(parts[0]);


  const minutes =
    Number(parts[1]);


  return (
    hours >= 0 &&
    hours <= 23 &&
    minutes >= 0 &&
    minutes <= 59
  );

}


/*
 * ================================================================
 * TIME CONVERSION
 * ================================================================
 */

function timeToMinutes(
  timeString
) {

  const parts =
    timeString.split(":");


  const hours =
    Number(parts[0]);


  const minutes =
    Number(parts[1]);


  return (
    hours * 60 +
    minutes
  );

}


/*
 * ================================================================
 * DATE PARSER
 * ================================================================
 *
 * Creates a local Date object from YYYY-MM-DD.
 *
 * The script timezone is Europe/London,
 * matching the CODON booking system.
 */

function parseDate(
  dateString
) {

  const parts =
    dateString.split("-");


  const year =
    Number(parts[0]);


  const month =
    Number(parts[1]) - 1;


  const day =
    Number(parts[2]);


  const date =
    new Date(
      year,
      month,
      day
    );


  date.setHours(
    0,
    0,
    0,
    0
  );


  return date;

}


/*
 * ================================================================
 * PARSE DATE + TIME
 * ================================================================
 */

function parseDateTime(
  dateString,
  timeString
) {

  const date =
    parseDate(
      dateString
    );


  const parts =
    timeString.split(":");


  date.setHours(
    Number(parts[0]),
    Number(parts[1]),
    0,
    0
  );


  return date;

}


/*
 * ================================================================
 * FORMAT SHEET DATE
 * ================================================================
 */

function formatSheetDate(
  value
) {

  if (
    value instanceof Date
  ) {

    return Utilities.formatDate(
      value,
      TIMEZONE,
      "yyyy-MM-dd"
    );

  }


  return String(
    value
  ).trim();

}


/*
 * ================================================================
 * FORMAT SHEET TIME
 * ================================================================
 */

function formatSheetTime(
  value
) {

  if (
    value instanceof Date
  ) {

    return Utilities.formatDate(
      value,
      TIMEZONE,
      "HH:mm"
    );

  }


  return String(
    value
  ).trim();

}


/*
 * ================================================================
 * FORMAT DATE FOR EMAIL
 * ================================================================
 */

function formatDateForEmail(
  dateString
) {

  const date =
    parseDate(
      dateString
    );


  return Utilities.formatDate(
    date,
    TIMEZONE,
    "EEEE d MMMM yyyy"
  );

}


/*
 * ================================================================
 * JSON RESPONSE
 * ================================================================
 */

function jsonResponse(
  data
) {

  return ContentService
    .createTextOutput(
      JSON.stringify(data)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );

}

/* ================================================================
 * ADMIN AUTHENTICATION
 * ================================================================
 */

/**
 * Get the admin secret from Apps Script Properties.
 */
function getAdminSecret() {

  const secret =
    PropertiesService
      .getScriptProperties()
      .getProperty("CODON_ADMIN_SECRET");

  if (!secret) {

    throw new Error(
      "CODON_ADMIN_SECRET has not been configured."
    );

  }

  return secret;

}

/* ================================================================
 * ADMIN — CANCEL BOOKING
 * ================================================================
 */

function cancelAdminBooking(
  adminSecret,
  bookingId
) {

  /*
   * Verify admin authentication.
   */

  if (
    !isValidAdminSecret(
      adminSecret
    )
  ) {

    return {

      success: false,

      message:
        "Unauthorised."

    };

  }


  /*
   * Validate Booking ID.
   */

  if (
    !bookingId ||
    String(
      bookingId
    ).trim() === ""
  ) {

    return {

      success: false,

      message:
        "Booking ID is required."

    };

  }


  /*
   * Use the existing cancellation system.
   */

  return cancelBooking(
    String(
      bookingId
    )
      .trim()
      .toUpperCase()
  );

}


/* ================================================================
 * ADMIN — RESCHEDULE BOOKING
 * ================================================================
 */

function rescheduleAdminBooking(
  adminSecret,
  bookingId,
  newDate,
  newTime
) {

  /*
   * Verify admin authentication.
   */

  if (
    !isValidAdminSecret(
      adminSecret
    )
  ) {

    return {

      success: false,

      message:
        "Unauthorised."

    };

  }


  /*
   * Validate inputs.
   */

  if (
    !bookingId ||
    !newDate ||
    !newTime
  ) {

    return {

      success: false,

      message:
        "Booking ID, date and time are required."

    };

  }


  /*
   * Use the existing rescheduling system.
   */

  return rescheduleBooking(

    String(
      bookingId
    )
      .trim()
      .toUpperCase(),

    String(
      newDate
    ).trim(),

    String(
      newTime
    ).trim()

  );

}

/**
 * Check whether the supplied admin secret is correct.
 */
function isValidAdminSecret(
  providedSecret
) {

  if (
    !providedSecret ||
    String(providedSecret).trim() === ""
  ) {

    return false;

  }

  return (
    String(providedSecret).trim() ===
    getAdminSecret()
  );

}

function testAdminAuthentication() {

  const secret =
    getAdminSecret();

  console.log(
    "Admin secret is configured:",
    Boolean(secret)
  );

}

/* ================================================================
 * ADMIN — GET BOOKINGS
 * ================================================================
 */

/**
 * Return all bookings for the admin dashboard.
 */
function getAdminBookings(
  adminSecret
) {

  /*
   * Verify admin authentication.
   */

  if (
    !isValidAdminSecret(
      adminSecret
    )
  ) {

    return {

      success: false,

      message:
        "Unauthorised."

    };

  }


  /*
   * Get booking sheet.
   */

  const sheet =
    getBookingSheet();


  const lastRow =
    sheet.getLastRow();


  /*
   * No bookings yet.
   */

  if (
    lastRow < 2
  ) {

    return {

      success: true,

      bookings: []

    };

  }


  /*
   * Get all booking rows.
   */

  const rows =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        11
      )
      .getValues();


  /*
   * Convert rows into clean booking objects.
   */

  const bookings =
    rows.map(
      row => {

        return {

          id:
            String(
              row[0]
            ),

          name:
            String(
              row[1]
            ),

          email:
            String(
              row[2]
            ),

          role:
            String(
              row[3]
            ),

          subject:
            String(
              row[4]
            ),

          message:
            String(
              row[5]
            ),

          date:
            formatSheetDate(
              row[6]
            ),

          time:
            formatSheetTime(
              row[7]
            ),

          calendarEventId:
            String(
              row[8]
            ),

          status:
            String(
              row[9]
            ),

          createdAt:
            row[10]

        };

      }
    );


  /*
   * Return bookings.
   */

  return {

    success: true,

    bookings:
      bookings

  };

}

function testGetAdminBookings() {

  const secret =
    getAdminSecret();

  const result =
    getAdminBookings(
      secret
    );

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

}

function testAdminSecretValue() {

  const secret =
    PropertiesService
      .getScriptProperties()
      .getProperty("CODON_ADMIN_SECRET");

  console.log({
    exists: Boolean(secret),
    length: secret ? secret.length : 0,
    value: secret
  });

}