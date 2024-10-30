import { Box, Text, Input, VStack } from '@chakra-ui/react';
import { useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { clarityLanguage } from '../utils/clarity-language';

interface ContractInputProps {
  onChange: (values: { name: string; code: string }) => void;
  values: {
    name: string;
    code: string;
  };
}

export default function ContractInput({ onChange, values }: ContractInputProps) {
  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...values, name: event.target.value });
  };

  const handleCodeChange = useCallback((code: string) => {
    onChange({ ...values, code });
  }, [onChange, values]);

  return (
    <VStack spacing={6} align="stretch">
      <Box>
        <Text 
          fontSize="md" 
          fontWeight="medium" 
          color="gray.200"
          mb={1}>
          Contract Name:
        </Text>
        <Input
          value={values.name}
          onChange={handleNameChange}
          placeholder="Enter contract name..."
          size="md"
          bg="nocc.card.bg"
          color="gray.800"
          borderColor="gray.300"
          _hover={{ borderColor: 'gray.400' }}
          _focus={{
            borderColor: 'nocc.primary',
            boxShadow: '0 0 0 1px var(--chakra-colors-nocc-primary)'
          }}
          _placeholder={{ color: 'gray.500' }}
        />
      </Box>

      <Box>
        <Text 
          fontSize="md" 
          fontWeight="medium" 
          color="gray.200"
          mt={4} 
          mb={1}>
          Clarity Smart Contract:
        </Text>
        <Box
          borderRadius="md"
          overflow="hidden"
          border="1px solid"
          borderColor="gray.300"
          _hover={{ borderColor: 'gray.400' }}
        >
          <CodeMirror
            value={values.code}
            height="400px"
            theme={vscodeDark}
            extensions={[clarityLanguage()]}
            onChange={handleCodeChange}
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              dropCursor: true,
              allowMultipleSelections: true,
              indentOnInput: true,
              syntaxHighlighting: true,
              bracketMatching: true,
              closeBrackets: true,
              autocompletion: true,
              rectangularSelection: true,
              crosshairCursor: true,
              highlightActiveLine: true,
              highlightSelectionMatches: true,
              closeBracketsKeymap: true,
              defaultKeymap: true,
              searchKeymap: true,
              historyKeymap: true,
              foldKeymap: true,
              completionKeymap: true,
              lintKeymap: true,
            }}
          />
        </Box>
      </Box>
    </VStack>
  );
}