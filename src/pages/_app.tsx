import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import { AppProps } from 'next/app';
import { Connect } from '@stacks/connect-react';
import { UserSession, AppConfig } from '@stacks/auth';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Head from 'next/head';

const theme = extendTheme({
  colors: {
    nocc: {
      primary: '#FFA500',      // Orange for NOCC text
      secondary: '#6B46C1',    // Purple from logo
      background: '#0F1115',   // Darker background
      header: '#1A1A1A',       // Dark header background
      card: {
        bg: '#FFFFFF',         // White card background
        border: '#E2E8F0'      // Card border color
      },
      text: {
        primary: '#FFFFFF',    // White text
        secondary: '#A0AEC0',  // Gray text for descriptions
        orange: '#FFA500',     // Orange text
        purple: '#6B46C1',     // Purple text
      },
      button: {
        primary: '#1A1A1A',    // Dark button
        hover: '#2D2D2D'       // Dark button hover
      }
    }
  },
  styles: {
    global: {
      body: {
        bg: 'nocc.background',
        color: 'nocc.text.primary',
        lineHeight: 'base',
      }
    }
  },
  components: {
    Button: {
      variants: {
        primary: {
          bg: 'nocc.button.primary',
          color: 'white',
          _hover: {
            bg: 'nocc.button.hover',
            transform: 'translateY(-2px)',
          },
          _active: {
            transform: 'translateY(0)',
          },
          transition: 'all 0.2s ease-in-out',
        },
        disconnect: {
          bg: '#2D2D2D',
          color: 'white',
          _hover: { bg: '#3D3D3D' }
        }
      }
    },
    Heading: {
      variants: {
        gradient: {
          bgGradient: 'linear(to-r, #FFA500, #6B46C1)',
          bgClip: 'text',
          fontSize: ['3xl', '4xl', '5xl'],
          fontWeight: 'bold',
          textAlign: 'center'
        }
      }
    },
    Text: {
      variants: {
        logo: {
          color: 'nocc.text.orange',
          fontSize: '24px',
          fontWeight: 'bold'
        },
        balance: {
          color: 'nocc.text.primary',
          fontSize: '16px'
        },
        description: {
          color: 'nocc.text.secondary',
          fontSize: '18px',
          lineHeight: 'tall',
          textAlign: 'center',
          maxW: '600px',
          mx: 'auto'
        },
        address: {
          color: 'nocc.text.secondary',
          fontSize: '14px',
          fontFamily: 'mono'
        }
      }
    },
    Box: {
      variants: {
        card: {
          bg: 'white',
          borderRadius: 'xl',
          boxShadow: 'xl',
          p: 6
        }
      }
    },
    Textarea: {
      baseStyle: {
        fontFamily: 'mono',
      },
      variants: {
        code: {
          bg: 'white',
          color: 'gray.800',
          border: '1px solid',
          borderColor: 'nocc.card.border',
          _hover: { borderColor: 'nocc.secondary' },
          _focus: { 
            borderColor: 'nocc.secondary',
            boxShadow: '0 0 0 1px var(--chakra-colors-nocc-secondary)'
          },
          fontSize: 'sm',
          lineHeight: 'short',
          spellCheck: 'false',
          resize: 'vertical',
        }
      },
      defaultProps: {
        variant: 'code'
      }
    }
  }
});

const appConfig = new AppConfig(['store_write', 'publish_data']);

function MyApp({ Component, pageProps }: AppProps): ReactNode {
  const [mounted, setMounted] = useState(false);
  const [userSessionState, setUserSessionState] = useState<UserSession | null>(null);

  useEffect(() => {
    setMounted(true);
    const session = new UserSession({ appConfig });
    setUserSessionState(session);
  }, []);

  if (!mounted) {
    return <div style={{ visibility: 'hidden' }}>Loading...</div>;
  }

  return (
    <>
      <Head>
        <title>NOCC Deployer</title>
        <link rel="icon" href="/nocc-logo.png" type="image/png" />
      </Head>
      <ChakraProvider theme={theme}>
        {userSessionState ? (
          <Connect
            authOptions={{
              appDetails: {
                name: 'NOCC Smart Contract Deployer',
                icon: '/nocc-logo.png',
              },
              userSession: userSessionState,
              onFinish: () => {
                window.location.reload();
              },
              onCancel: () => {
                console.log('Authentication canceled');
              },
            }}
          >
            <Component {...pageProps} />
          </Connect>
        ) : (
          <div style={{ visibility: 'hidden' }}>Loading...</div>
        )}
      </ChakraProvider>
    </>
  );
}

export default MyApp;