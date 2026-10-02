// UART transmitter, 8N1, CLKS_PER_BIT clocks per bit
module uart_tx #(parameter CLKS_PER_BIT = 4)(input clk, input start, input [7:0] data, output reg tx, output reg busy);
  reg [3:0] bit_index; reg [9:0] shifter; reg [7:0] count;
  initial begin tx = 1; busy = 0; end
  always @(posedge clk) begin
    if (!busy) begin
      if (start) begin shifter <= {1'b1, data, 1'b0}; busy <= 1; bit_index <= 0; count <= 0; end
    end else if (count == CLKS_PER_BIT - 1) begin
      count <= 0;
      tx <= shifter[0]; shifter <= shifter >> 1;
      if (bit_index == 9) busy <= 0; else bit_index <= bit_index + 1;
    end else begin
      if (count == 0 && bit_index == 0) tx <= shifter[0];
      count <= count + 1;
    end
  end
endmodule
module tb;
  reg clk = 0, start = 0; reg [7:0] data; wire tx, busy;
  uart_tx #(.CLKS_PER_BIT(4)) dut(clk, start, data, tx, busy);
  always #1 clk = ~clk;
  initial $monitor("%0t tx=%b busy=%b", $time, tx, busy);
  initial begin data = 8'hA5; #2 start = 1; #2 start = 0; wait_done; $finish; end
  task wait_done; begin #100; end endtask
endmodule
