import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import Sidebar from 'react-sidebar';
import Slider from 'react-rangeslider';
import {Line} from 'react-chartjs-2';
import ToggleButton from 'react-toggle-button';
import styles from 'styles';

//            <button onClick={() => this.onSetSidebarOpen(true)}>
//                Open Sidebar
//            </button>

function chartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            yAxes: [{
                scaleLabel: {
                    labelString: 'Temperature (F)',
                    display: true
                }
            }],
            xAxes: [{
                type: 'time',
                scaleLabel: {
                    labelString: 'Time',
                    display: true
                },
                time: {
                    displayFormats: {
                        quarter: 'MMM YYYY',
                        month:   'MMM YYYY',
                        day:     'MMM D',
                        hour:    'hA',
                        minute:  'h:mm a'
                        
                    }
                }
            }]
        }
    };
}

function chartData() {
  return {
    labels: [],
    datasets: [
      {
        label: 'Carboy',
        backgroundColor: 'rgba(220,220,220,0.1)',
        borderColor: 'rgba(220,220,220,1)',
        pointBorderColor: 'rgba(220,220,220,1)',
        pointStrokeColor: '#fff',
        pointHighlightFill: '#fff',
        pointHoverBackgroundColor: 'rgba(220,220,220,1)',
        data: [],
      },
      {
        label: 'Chamber',
        backgroundColor: 'rgba(49,43,219,0.1)',
        borderColor: 'rgba(49,43,219,1)',
        pointBorderColor: 'rgba(49,43,219,1)',
        pointStrokeColor: '#fff',
        pointHighlightFill: '#fff',
        pointHoverBackgroundColor: 'rgba(49,43,219,1)',
        data: [],
      },
      /*{
        label: 'Room',
        backgroundColor: 'rgba(43,181,219,0.2)',
        borderColor: 'rgba(43,181,219,1)',
        pointBorderColor: 'rgba(43,181,219,1)',
        pointStrokeColor: '#fff',
        pointHighlightFill: '#fff',
        pointHoverBackgroundColor: 'rgba(43,181,219,1)',
        data: [],
      }, */
      {
        label: 'Set',
        backgroundColor: 'rgba(47,175,45,0.1)',
        borderColor: 'rgba(47,175,45,1)',
        pointBorderColor: 'rgba(47,175,45,1)',
        pointStrokeColor: '#fff',
        pointHighlightFill: '#fff',
        pointHoverBackgroundColor: 'rgba(47,175,45,1)',
        data: [],
      },
      /*{
        label: 'Set Control',
        backgroundColor: 'rgba(175,60,45,0.1)',
        borderColor: 'rgba(175,60,45,1)',
        pointBorderColor: 'rgba(175,60,45,1)',
        pointStrokeColor: '#fff',
        pointHighlightFill: '#fff',
        pointHoverBackgroundColor: 'rgba(175,60,45,1)',
        data: [],
      }, */
    ]
  }
}

class Horizontal extends Component {
    constructor(props) {
        super(props);
        this.state = {
            value: this.props.val,
        }
        this.handleChange = this.handleChange.bind(this);
        this.handleChangeComplete = this.handleChangeComplete.bind(this);
    }
    
    handleChange(newVal) {
        this.props.onSliderChange(newVal);
    }
    
    handleChangeComplete(newVal) {
        this.props.onSliderChangeComplete(newVal);
    }
    
    render() {
        const { value } = this.state
        const title = this.props.title
        const min = parseInt(this.props.min)
        const max = parseInt(this.props.max)
        return (
            <table>
            <col width="130"/>
            <col width="130"/>
                <tr>
                  <td style={{'text-align': 'left'}}> {title}   </td>
                  <td> <Slider className='slider'
                    min={min}
                    max={max}
                    value={this.props.val}
                    onChange={this.handleChange}
                    onChangeComplete={this.handleChangeComplete}
                /> </td>
                </tr>
                <tr>
                  <td>     </td>
                  <td> <div className='value'>{this.props.val}</div> </td>
                </tr>
                </table>
        )
    }
}

class Toggle extends Component {
  constructor(props) {
    super(props);
    this.state = {isToggleOn: true};

    this.handleClick = this.handleClick.bind(this);
  }

  handleClick() {
   this.setState(prevState => ({
     isToggleOn: !prevState.isToggleOn
   }));
  };

  render() {
    return (
      <button onClick={this.handleClick}>
        {this.state.isToggleOn ? 'ON' : 'OFF'}
      </button>
    );
  }
}



class App extends Component {
    constructor(props) {
        super(props);
        this.state = {
            response: '',
            sidebarOpen: false,
            data: chartData(),
            tempSet: 0,
            scriptRunning: 0,
            hysteresisWidth: 0,
            gainP: 0,
            onOff: 0,
        };
        this.onSetSidebarOpen = this.onSetSidebarOpen.bind(this);
        this.componentDidMount = this.componentDidMount.bind(this);
        this.componentWillMount = this.componentWillMount.bind(this);
        this.getGraphData = this.getGraphData.bind(this);
        this.getSettings = this.getSettings.bind(this);
        this.onTempChange = this.onTempChange.bind(this);
        this.onGainChange = this.onGainChange.bind(this);
        this.onWidthChange = this.onWidthChange.bind(this);
        this.onTempChangeComplete = this.onTempChangeComplete.bind(this);
        this.onGainChangeComplete = this.onGainChangeComplete.bind(this);
        this.onWidthChangeComplete = this.onWidthChangeComplete.bind(this);
        this.onToggle = this.onToggle.bind(this);
        
        setInterval(this.getGraphData, 60*1000);
      }

      componentWillMount() {
          this.getSettings();
      }

      componentDidMount() {
        this.getGraphData();
      }

      getSettings = async () => {
          const response = await fetch('/api/config');
          const body = await response.json();
          let tempVal,scriptRunVal,hwidthVal,gainVal;
          body.forEach(function(v,i) {
              if (v.name === "Temp_Set") {
                  tempVal = v.value;
              }
              else if (v.name === "Script_running") {
                  scriptRunVal = parseInt(v.value);
              }
              else if (v.name === "Hysteresis_Width") {
                  hwidthVal = v.value;
              }
              else if (v.name === "Gain_P") {
                  gainVal = v.value;
              }
          });
          this.setState(
          {
            tempSet: tempVal,
            scriptRunning: scriptRunVal,
            hysteresisWidth: hwidthVal,
            gainP: gainVal
          });
      }
      
      getGraphData = async () => {
        let dates           = [];
        let temp_chamber    = [];
        let temp_carboy     = [];
        let temp_room       = [];
        let temp_set        = [];
        let temp_set_control= [];
        let temp_hysteresis = [];
        let compressor_on   = [];
        const response = await fetch('/api/graphdata');
        const body = await response.json();
        if (response.status !== 200) throw Error(body.message);
        body.forEach(function(v,i) {
            dates.unshift(v.time_sample);
            temp_chamber.unshift(v.temp_chamber);
            temp_carboy.unshift(v.temp_carboy);
            temp_room.unshift(v.temp_room);
            temp_set.unshift(v.temp_set);
            temp_set_control.unshift(v.temp_set_control);
            temp_hysteresis.unshift(v.temp_hysteresis);
            compressor_on.unshift(v.compressor_on);
        });
        
        let graphstuff = chartData();
        graphstuff.labels = dates;
        graphstuff.datasets[0].data = temp_carboy;
        graphstuff.datasets[1].data = temp_chamber;
        //graphstuff.datasets[2].data = temp_room;
        graphstuff.datasets[2].data = temp_set;
        //graphstuff.datasets[3].data = temp_set_control;
        this.setState({ data: graphstuff });
      }
      
      onSetSidebarOpen(open) {
          this.setState({ sidebarOpen: open });
          
      }
      
      onTempChange = (newTemp) => {
          this.setState({tempSet: newTemp});
      }
      
      onTempChangeComplete = () => {
          fetch('/api/settings', {
              method: "POST",
              headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({Temp_Set: this.state.tempSet})
          });
      }
      
      onGainChange(newGain) {
          this.setState({gainP: newGain});
      }
      
      
      onGainChangeComplete = async (newGain) => {
          fetch('/api/settings', {
              method: "POST",
              headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({Gain_P: this.state.gainP})
          });
      }
      
      onWidthChange(newWidth) {
          this.setState({hysteresisWidth: newWidth});
      }
      
      onWidthChangeComplete = async (newWidth) => {
          fetch('/api/settings', {
              method: "POST",
              headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({Hysteresis_Width: this.state.hysteresisWidth})
          });
      }

    onToggle = async (onOff) => {
        
        this.setState({ scriptRunning: !onOff});
        
        fetch('/api/onoff', {
            method: "POST",
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({onoff: !onOff})
        });
    }

      render() {
        return (
        <Sidebar
         sidebar={<b>Sidebar content</b>}
         open={this.state.sidebarOpen}
         onSetOpen={this.onSetSidebarOpen}
         styles={{ sidebar: { background: "white" } }}
         >
            <div className="App">
                <header className="App-header">
                  <img src={logo} className="App-logo" alt="logo" />
                  <h1 className="App-title">Fermentation Chamber</h1>
                </header>
                <p className="App-intro">
                    
                    <table>
                    <col width="130"/>
                    <col width="130"/>
                        <tr>
                          <td style={{'text-align': 'left'}}> Power State   </td>
                          <td> 
                          <ToggleButton
                          colors={{
                            active: {
                              base: 'rgb(89,0,179)',
                              hover: 'rgb(134,91,179)',
                            },
                            inactive: {
                              base: 'rgb(65,66,68)',
                              hover: 'rgb(95,96,98)',
                            }
                          }}
                          inactiveLabel="OFF"
                          activeLabel="ON"
                          value={this.state.scriptRunning}
                          onToggle={this.onToggle} />
                          </td>
                        </tr>
                        </table>
                    
                    <Horizontal title="Temperature" min="40" max="80" val={this.state.tempSet} onSliderChange={this.onTempChange} onSliderChangeComplete={this.onTempChangeComplete}/>
                    <Horizontal title="Gain" min="0" max="20" val={this.state.gainP} onSliderChange={this.onGainChange} onSliderChangeComplete={this.onGainChangeComplete}/>
                    <Horizontal title="Hysteresis" min="1" max="10" val={this.state.hysteresisWidth} onSliderChange={this.onWidthChange} onSliderChangeComplete={this.onWidthChangeComplete}/>
                    <div style={{"height": "500px"}}>
                        <Line data={this.state.data} options={chartOptions()} />
                    </div>
                </p>
            </div>
        </Sidebar>
        
          
        );
      }
}

export default App;
