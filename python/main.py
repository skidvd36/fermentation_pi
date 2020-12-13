# Main routine to manage temperature readings, writing to database, and powering the
# compressor on and off

# Imports
import os
import sys
import glob
import time
import datetime
import RPi.GPIO as GPIO
import mysql.connector
from enum import Enum
from mysql.connector import errorcode


# Global Variables
class States(Enum):
    LOW  = 0
    HIGH = 1

probe_file_dirs     = glob.glob('/sys/bus/w1/devices/' + '28*')
probe_file_chamber  = probe_file_dirs[0] + '/w1_slave'
probe_file_carboy   = probe_file_dirs[1] + '/w1_slave'
probe_file_room     = probe_file_dirs[2] + '/w1_slave' #Change to probe_file_dirs[2] once new temp probe is inserted


sql_config = {
    'user'      : 'TempWriter',
    'password'  : 'TempWriter123',
    'host'      : '127.0.0.1',
    'database'  : 'Fermentation',
}

relay_pin = 17

temp_state = States.LOW

state_time = None

# Initialize Pins
def init():
    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)
    GPIO.setup(relay_pin, GPIO.OUT, initial=GPIO.LOW)

# Reads temperature
def read_temp_raw(file_name):
    f       = open(file_name, 'r')
    lines   = f.readlines()
    f.close()
    return lines

# Read temperature and return celcius and fahrenheit reading 
def read_temps(file_name):
    lines = read_temp_raw(file_name)
    while lines[0].strip()[-3:] != 'YES':
        time.sleep(0.2)
        lines = read_temp_raw(file_name)
    equals_pos = lines[1].find('t=')
    if equals_pos != -1:
        temp_string = lines[1][equals_pos+2:]
        temp_c      = float(temp_string) / 1000.0
        temp_f      = temp_c * 9.0/5.0 + 32.0
        return temp_f

# Read all temperatures and error flag
def read_all_temps():
    try:
        temp_carboy = read_temps(probe_file_carboy)
        temp_chamber= read_temps(probe_file_chamber)
        temp_room   = read_temps(probe_file_room)
        return temp_carboy, temp_chamber, temp_room, 0
    except:
        return 0, 0, 0, 1

# Turn compressor on or off
def power_compressor(on_off):
    GPIO.output(relay_pin, on_off)

# Calculate temperature to set
def pid_controller(mid_temp, temp_carboy, gain_p):
    
    print("Carboy:" + str(temp_carboy))
    print("Mid:" + str(mid_temp))
    print("Gain:" + str(gain_p))
    temp_dif    = temp_carboy - mid_temp
    print("Diff:" + str(temp_dif))
    print("Mult:" + str(float(gain_p) * temp_dif))
    temp_thresh = mid_temp - (float(gain_p) * temp_dif)
    return temp_thresh

# Temperature State Machine
def advance_state(current_temp, mid_temp, hysteresis_width, compressor_min_off, compressor_min_on, temp_state, state_time):
    lower_temp = mid_temp - hysteresis_width/2
    upper_temp = mid_temp + hysteresis_width/2

    if temp_state == States.HIGH:
        if current_temp < lower_temp and state_timer_check(state_time, compressor_min_on):
            power_compressor(0)
            temp_state = States.LOW
            state_time = datetime.datetime.now()
    elif temp_state == States.LOW:
        if current_temp > upper_temp and state_timer_check(state_time, compressor_min_off):
            power_compressor(1)
            temp_state = States.HIGH
            state_time = datetime.datetime.now()

    return temp_state,state_time

# Check state timer. True indicates you are good to go.
def state_timer_check(state_time, time_min):
    if state_time is None:
        return True

    time_now = datetime.datetime.now()
    elapsed_time = time_now - state_time
    return divmod(elapsed_time.total_seconds(), 60)[0] > time_min

# Gets the set temperature and hysteresis width
def get_settings():
    temp_set            = None
    hysteresis_width    = None
    compressor_min_off  = None
    compressor_min_on   = None
    gain_p              = None

    try:
        cnx = mysql.connector.connect(**sql_config)
    except mysql.connector.Error as err:
        print("Could not connect to database")
        raise

    cursor          = cnx.cursor()
    query_settings  = """SELECT name, value
                         FROM Settings"""
    cursor.execute(query_settings)

    for (name, value) in cursor:
        if (name == "Temp_Set"):
            temp_set = float(value)
        if (name == "Hysteresis_Width"):
            hysteresis_width = float(value)
        if (name == "Compressor_min_off"):
            compressor_min_off = float(value)
        if (name == "Compressor_min_on"):
            compressor_min_on = float(value)
        if (name == "Gain_P"):
            gain_p = value;

    return temp_set, hysteresis_width, compressor_min_off, compressor_min_on, gain_p

# Inserts new temperature reading to Temperatures database
def insert_temp(temp_chamber, temp_carboy, temp_room, temp_set, temp_set_control, temp_hysteresis, compressor_on):
    current_time = datetime.datetime.now()

    try:
        cnx = mysql.connector.connect(**sql_config)
    except mysql.connector.Error as err:
        print("Could not connect to database")
        raise

    cursor      = cnx.cursor()
    query_temp  = """INSERT INTO Temperatures
               (time_sample, temp_chamber, temp_carboy, temp_room, temp_set, temp_set_control, temp_hysteresis, compressor_on)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)"""
    data_temp   = (current_time, temp_chamber, temp_carboy, temp_room, temp_set, temp_set_control, temp_hysteresis, compressor_on.value)

    cursor.execute(query_temp, data_temp)

    cnx.commit()
    cursor.close()
    cnx.close()

# Sets database Script_running flag to 1
def script_start():
    cnx = mysql.connector.connect(**sql_config)
    cursor = cnx.cursor()
    query_temp = """UPDATE Settings SET value=1 WHERE name=\"Script_running\""""
    
    cursor.execute(query_temp)
    
    cnx.commit()
    cursor.close()
    cnx.close()

# Sets database Script_running flag to 0
def script_stop():
    cnx = mysql.connector.connect(**sql_config)
    cursor = cnx.cursor()
    query_temp = """UPDATE Settings SET value=0 WHERE name=\"Script_running\""""
    
    cursor.execute(query_temp)
    
    cnx.commit()
    cursor.close()
    cnx.close()


try:
    script_start()
    init()
    minute_trig = datetime.datetime.now().minute
    while True:
        if (datetime.datetime.now().minute != minute_trig):
            minute_trig                                     = datetime.datetime.now().minute
            # Get temps
            error                                           = 1
            while error == 1:
                temp_carboy, temp_chamber, temp_room, error = read_all_temps()
                time.sleep(2)
            # Get settings
            temp_set, hysteresis_width, \
            compressor_min_off, compressor_min_on, gain_p   = get_settings()
            # Get temp to set
            temp_thresh                                     = pid_controller(temp_set, temp_carboy, gain_p)
            # Advance state
            temp_state, state_time                          = advance_state(temp_chamber, temp_thresh, hysteresis_width, compressor_min_off, compressor_min_on, temp_state, state_time)
            # Insert temp
            insert_temp(temp_chamber, temp_carboy, temp_room, temp_set, temp_thresh, hysteresis_width, temp_state)
        time.sleep(5)
except Exception as inst:
    print(inst)
    script_stop()
    power_compressor(0)
    print("End of program...")
    sys.exit()