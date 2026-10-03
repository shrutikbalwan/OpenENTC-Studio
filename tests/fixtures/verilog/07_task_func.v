module tb;
  reg [7:0] x; reg [15:0] y;
  function [15:0] square; input [7:0] v; begin square = v * v; end endfunction
  function integer clog2; input integer value; integer t; begin t = value - 1; for (clog2 = 0; t > 0; clog2 = clog2 + 1) t = t >> 1; end endfunction
  task show; input [7:0] v; begin #2 $display("t=%0t v=%d sq=%d", $time, v, square(v)); end endtask
  initial begin
    x = 12; y = square(x); $display("%d %d", x, y);
    show(5); show(250);
    $display("clog2 %0d %0d %0d", clog2(1), clog2(16), clog2(17));
    $finish;
  end
endmodule
