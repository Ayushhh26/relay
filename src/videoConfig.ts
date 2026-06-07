export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.relay.metered.ca:80' },
  {
    urls: 'turn:standard.relay.metered.ca:80',
    username: '2c2a0d7deef4393e7884d540',
    credential: 'I4beD+C+sG1TTz3d',
  },
  {
    urls: 'turn:standard.relay.metered.ca:80?transport=tcp',
    username: '2c2a0d7deef4393e7884d540',
    credential: 'I4beD+C+sG1TTz3d',
  },
  {
    urls: 'turn:standard.relay.metered.ca:443',
    username: '2c2a0d7deef4393e7884d540',
    credential: 'I4beD+C+sG1TTz3d',
  },
  {
    urls: 'turns:standard.relay.metered.ca:443?transport=tcp',
    username: '2c2a0d7deef4393e7884d540',
    credential: 'I4beD+C+sG1TTz3d',
  },
]
